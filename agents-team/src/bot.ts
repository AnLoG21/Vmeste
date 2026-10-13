import { Bot, InlineKeyboard } from "grammy";
import { HttpsProxyAgent } from "https-proxy-agent";
import nodeFetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import { intakeMessage } from "./agents/pm.js";
import { runWithChatContext } from "./chatContext.js";
import { config } from "./config.js";
import {
  clearPendingClarification,
  formatHistory,
  getConversation,
  pushMessage,
  setPendingClarification,
} from "./conversation.js";
import { setLlmWaitNotifier } from "./llm/client.js";
import { runPendingDeveloper, runTeamTask } from "./orchestrator.js";
import { createJob, getJob, listJobsForUser, updateJob } from "./store.js";
import { replyChunks } from "./telegram.js";

function isAllowed(userId: number | undefined): boolean {
  return Boolean(userId && config.allowedUserIds.includes(userId));
}

function proxyAgent(proxyUrl: string) {
  if (/^socks/i.test(proxyUrl)) return new SocksProxyAgent(proxyUrl);
  return new HttpsProxyAgent(proxyUrl);
}

async function progress(ctx: { reply: (t: string) => Promise<unknown> }, text: string) {
  await ctx.reply(text);
}

function wantsDeveloperConfirm(text: string): boolean {
  return /^(да|ок|okay|ok|запускай|поехали|го|yes|ага|подтверждаю)([\s,!.]|$)/i.test(text.trim()) ||
    /запускай разработчик|запусти разработчик|да.*разработчик/i.test(text);
}

export function createBot(): Bot {
  const client: Record<string, unknown> = {
    apiRoot: config.telegramApiRoot,
  };
  if (config.telegramHttpProxy) {
    const agent = proxyAgent(config.telegramHttpProxy);
    client.fetch = (input: unknown, init?: Record<string, unknown>) => {
      const url =
        typeof input === "string" || input instanceof URL
          ? String(input)
          : String((input as { url: string }).url);
      return nodeFetch(url, { ...init, agent });
    };
    console.log(`[agents-team] Telegram via proxy ${config.telegramHttpProxy}`);
  }

  const bot = new Bot(config.telegramToken, { client: client as never });

  bot.use(async (ctx, next) => {
    if (!isAllowed(ctx.from?.id)) {
      if (ctx.message?.text || ctx.callbackQuery) {
        await ctx.reply("Доступ закрыт. Добавьте свой Telegram user id в TELEGRAM_ALLOWED_USER_IDS.");
      }
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(
      [
        "Команда «Вместе» в чате.",
        "",
        "Пишите обычным текстом — без /task.",
        "Если чего-то не хватает — спрошу. Потом роли сами сделают свою часть.",
        "",
        "Опционально: /status — последние задачи, /whoami — ваш id.",
      ].join("\n")
    );
  });

  bot.command("whoami", async (ctx) => {
    await ctx.reply(`Ваш id: ${ctx.from?.id}`);
  });

  bot.command("status", async (ctx) => {
    const jobs = listJobsForUser(ctx.from!.id);
    if (!jobs.length) {
      await ctx.reply("Задач пока нет — просто напишите, что нужно.");
      return;
    }
    await ctx.reply(
      jobs.map((j) => `• ${j.id} [${j.status}] ${j.task.slice(0, 80)}`).join("\n")
    );
  });

  bot.command("task", async (ctx) => {
    const task = ctx.message?.text?.replace(/^\/task(@\w+)?\s*/i, "").trim();
    if (!task) {
      await ctx.reply("Можно без команды: просто опишите задачу сообщением.");
      return;
    }
    await handleUserText(ctx, task, { forceExecute: true });
  });

  bot.command("dev", async (ctx) => {
    const id = ctx.message?.text?.replace(/^\/dev(@\w+)?\s*/i, "").trim();
    if (!id) {
      await ctx.reply("Укажите id задачи или напишите «да, запускай разработчика» после отчёта.");
      return;
    }
    await launchDeveloper(ctx.reply.bind(ctx), ctx.from?.id, id);
  });

  bot.callbackQuery(/^dev:(.+)$/, async (ctx) => {
    const id = ctx.match?.[1];
    if (!id) return;
    await ctx.answerCallbackQuery({ text: "Запускаю разработчика…" });
    await launchDeveloper(ctx.reply.bind(ctx), ctx.from?.id, id);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;
    await handleUserText(ctx, text);
  });

  return bot;
}

type TextCtx = {
  chat: { id: number };
  from?: { id: number };
  reply: (t: string, extra?: Record<string, unknown>) => Promise<unknown>;
};

async function handleUserText(
  ctx: TextCtx,
  text: string,
  options: { forceExecute?: boolean } = {}
) {
  const userId = ctx.from!.id;
  const conv = getConversation(ctx.chat.id, userId);

  if (conv.busy) {
    await ctx.reply("Сейчас уже работаем над предыдущим сообщением. Напишите следом — возьму после.");
    return;
  }

  const awaiting = listJobsForUser(userId).find((j) => j.status === "awaiting_dev");
  if (awaiting && wantsDeveloperConfirm(text)) {
    pushMessage(conv, "user", text);
    await launchDeveloper(ctx.reply.bind(ctx), userId, awaiting.id);
    return;
  }

  conv.busy = true;
  pushMessage(conv, "user", text);
  setLlmWaitNotifier(async (msg) => {
    await ctx.reply(msg);
  });

  await runWithChatContext(
    {
      chatId: ctx.chat.id,
      userId,
      history: formatHistory(conv, 16),
    },
    async () => {
      try {
        const answering = Boolean(conv.pendingQuestions?.length && conv.draftTask);
        const draftTask = conv.draftTask;
        const clarifyRoundsAlready = conv.clarifyRounds || 0;

        if (options.forceExecute) {
          clearPendingClarification(conv);
          await ctx.reply("Принял. Запускаю команду.");
          pushMessage(conv, "assistant", "Принял. Запускаю команду.");
          await executeTask(ctx, conv, text);
          return;
        }

        // After any answer to clarifications — skip LLM intake churn, just run
        if (answering && draftTask) {
          const task = `${draftTask}\n\nУточнения от заказчика:\n${text}`.trim();
          clearPendingClarification(conv);
          await ctx.reply("Достаточно, больше не спрашиваю. Запускаю команду…");
          pushMessage(conv, "assistant", "Достаточно, больше не спрашиваю. Запускаю команду…");
          await executeTask(ctx, conv, task);
          return;
        }

        await ctx.reply(
          config.llmProvider === "cursor"
            ? "Смотрю (Cursor + история чата)…"
            : "Смотрю…"
        );
        const intake = await intakeMessage({
          message: text,
          history: formatHistory(conv, 16),
          answeringClarification: false,
          clarifyRoundsAlready,
          ...(draftTask ? { draftTask } : {}),
        });

        if (intake.mode === "chat") {
          clearPendingClarification(conv);
          await ctx.reply(intake.reply);
          pushMessage(conv, "assistant", intake.reply);
          return;
        }

        if (intake.mode === "clarify" && clarifyRoundsAlready < 1) {
          setPendingClarification(conv, text, intake.questions);
          await ctx.reply(intake.reply);
          pushMessage(conv, "assistant", intake.reply);
          return;
        }

        clearPendingClarification(conv);
        await ctx.reply(intake.reply || "Принял. Запускаю команду.");
        pushMessage(conv, "assistant", intake.reply || "Принял. Запускаю команду.");
        await executeTask(ctx, conv, intake.task || text, intake.plan);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await ctx.reply(`Ошибка: ${message}`);
        pushMessage(conv, "assistant", `Ошибка: ${message}`);
      } finally {
        setLlmWaitNotifier(null);
        conv.busy = false;
      }
    }
  );
}

async function executeTask(
  ctx: TextCtx,
  conv: ReturnType<typeof getConversation>,
  task: string,
  plan?: Awaited<ReturnType<typeof intakeMessage>>["plan"]
) {
  const job = createJob({
    chatId: ctx.chat.id,
    userId: ctx.from!.id,
    task,
  });
  conv.lastJobId = job.id;

  try {
    const result = await runTeamTask(job.id, (m) => progress(ctx, m), {
      runDeveloperNow: true,
      ...(plan ? { plan } : {}),
    });
    await replyChunks((t) => ctx.reply(t), `✅ Готово`, result.report);
    pushMessage(conv, "assistant", result.report.slice(0, 500));
    if (result.awaitingDev) {
      const kb = new InlineKeyboard().text("💻 Запустить разработчика", `dev:${job.id}`);
      await ctx.reply("Могу сразу запустить разработчика — нажмите или напишите «да».", {
        reply_markup: kb,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(job.id, { status: "error", error: message });
    await ctx.reply(`Ошибка по задаче: ${message}`);
    pushMessage(conv, "assistant", `Ошибка: ${message}`);
  }
}

async function launchDeveloper(
  reply: (t: string) => Promise<unknown>,
  userId: number | undefined,
  jobId: string
) {
  const job = getJob(jobId);
  if (!job) {
    await reply("Задача не найдена (живёт в памяти процесса — после рестарта бота старые id пропадают).");
    return;
  }
  if (job.userId !== userId) {
    await reply("Это чужая задача.");
    return;
  }
  const conv = getConversation(job.chatId, job.userId);
  if (conv.busy) {
    await reply("Уже заняты — напишите чуть позже.");
    return;
  }
  conv.busy = true;
  try {
    const report = await runPendingDeveloper(jobId, async (m) => {
      await reply(m);
    });
    await replyChunks(reply, `✅ Разработчик`, report);
    pushMessage(conv, "assistant", report.slice(0, 500));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(jobId, { status: "error", error: message });
    await reply(`Ошибка разработчика: ${message}`);
  } finally {
    conv.busy = false;
  }
}
