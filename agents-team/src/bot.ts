import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { runPendingDeveloper, runTeamTask } from "./orchestrator.js";
import { createJob, getJob, listJobsForUser, updateJob } from "./store.js";
import { replyChunks } from "./telegram.js";

function isAllowed(userId: number | undefined): boolean {
  return Boolean(userId && config.allowedUserIds.includes(userId));
}

async function progress(ctx: { reply: (t: string) => Promise<unknown> }, text: string) {
  await ctx.reply(text);
}

export function createBot(): Bot {
  const bot = new Bot(config.telegramToken, {
    client: {
      apiRoot: config.telegramApiRoot,
    },
  });

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
        "Команда Вместе в Telegram.",
        "",
        "/task <текст> — поставить задачу команде",
        "/status — последние задачи",
        "/dev <id> — запустить разработчика по задаче",
        "/whoami — ваш Telegram id",
        "",
        "Роли: PM → аналитик + SEO → (опционально) разработчик Cursor SDK.",
      ].join("\n")
    );
  });

  bot.command("whoami", async (ctx) => {
    await ctx.reply(`Ваш id: ${ctx.from?.id}`);
  });

  bot.command("status", async (ctx) => {
    const jobs = listJobsForUser(ctx.from!.id);
    if (!jobs.length) {
      await ctx.reply("Задач пока нет. /task …");
      return;
    }
    await ctx.reply(
      jobs
        .map((j) => `• ${j.id} [${j.status}] ${j.task.slice(0, 80)}`)
        .join("\n")
    );
  });

  bot.command("task", async (ctx) => {
    const task = ctx.message?.text?.replace(/^\/task(@\w+)?\s*/i, "").trim();
    if (!task) {
      await ctx.reply("Пример: /task улучшить SEO главной и предложить правки");
      return;
    }
    const job = createJob({
      chatId: ctx.chat!.id,
      userId: ctx.from!.id,
      task,
    });
    await ctx.reply(`Принял задачу ${job.id}. Команда работает…`);

    try {
      const result = await runTeamTask(job.id, (m) => progress(ctx, m));
      await replyChunks((t) => ctx.reply(t), `✅ Итог ${job.id}`, result.report);
      if (result.awaitingDev) {
        const kb = new InlineKeyboard().text("💻 Запустить разработчика", `dev:${job.id}`);
        await ctx.reply("Подтвердите запуск Cursor-разработчика:", { reply_markup: kb });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateJob(job.id, { status: "error", error: message });
      await ctx.reply(`Ошибка по ${job.id}: ${message}`);
    }
  });

  bot.command("dev", async (ctx) => {
    const id = ctx.message?.text?.replace(/^\/dev(@\w+)?\s*/i, "").trim();
    if (!id) {
      await ctx.reply("Укажите id: /dev t…");
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
    // Plain text = short task
    await ctx.reply(`Воспринял как задачу. Запускаю… (или используйте /task)`);
    const job = createJob({
      chatId: ctx.chat.id,
      userId: ctx.from!.id,
      task: text,
    });
    try {
      const result = await runTeamTask(job.id, (m) => progress(ctx, m));
      await replyChunks((t) => ctx.reply(t), `✅ Итог ${job.id}`, result.report);
      if (result.awaitingDev) {
        const kb = new InlineKeyboard().text("💻 Запустить разработчика", `dev:${job.id}`);
        await ctx.reply("Подтвердите запуск Cursor-разработчика:", { reply_markup: kb });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateJob(job.id, { status: "error", error: message });
      await ctx.reply(`Ошибка по ${job.id}: ${message}`);
    }
  });

  return bot;
}

async function launchDeveloper(
  reply: (t: string) => Promise<unknown>,
  userId: number | undefined,
  jobId: string
) {
  const job = getJob(jobId);
  if (!job) {
    await reply("Задача не найдена (живёт только в памяти процесса — не перезапускайте бота).");
    return;
  }
  if (job.userId !== userId) {
    await reply("Это чужая задача.");
    return;
  }
  try {
    const report = await runPendingDeveloper(jobId, async (m) => {
      await reply(m);
    });
    await replyChunks(reply, `✅ Dev ${jobId}`, report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(jobId, { status: "error", error: message });
    await reply(`Ошибка разработчика: ${message}`);
  }
}
