import { runAnalyst } from "./agents/analyst.js";
import { runBackend } from "./agents/backend.js";
import { runDeveloper } from "./agents/developer.js";
import { runFrontend } from "./agents/frontend.js";
import { debate, planTask, synthesize, type TeamPlan } from "./agents/pm.js";
import { runSeo } from "./agents/seo.js";
import { runTester } from "./agents/tester.js";
import { config } from "./config.js";
import { setLlmWaitNotifier } from "./llm/client.js";
import { getJob, updateJob, type Job } from "./store.js";

export type ProgressFn = (message: string) => Promise<void>;

export type OrchestratorResult = {
  job: Job;
  plan: TeamPlan;
  report: string;
  awaitingDev: boolean;
};

function buildCursorBrief(
  plan: TeamPlan,
  parts: {
    debate?: string;
    backend?: string;
    frontend?: string;
    tester?: string;
  }
): string {
  return [
    plan.developerBrief || "Выполни задачу в репозитории Vmeste.",
    parts.debate ? `\n## Итог обсуждения команды\n${parts.debate}` : "",
    parts.backend ? `\n## Backend-план\n${parts.backend}` : "",
    parts.frontend ? `\n## Frontend-план\n${parts.frontend}` : "",
    parts.tester ? `\n## Тест-план\n${parts.tester}` : "",
    "\nНе коммить и не пушь без явной просьбы. В конце: файлы, как проверить.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runTeamTask(
  jobId: string,
  onProgress: ProgressFn,
  options: { runDeveloperNow?: boolean; plan?: TeamPlan } = {}
): Promise<OrchestratorResult> {
  const job = getJob(jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);

  setLlmWaitNotifier(async (msg) => {
    await onProgress(msg);
  });

  try {
    updateJob(jobId, { status: "running" });
    await onProgress("🧭 PM собирает план…");
    const plan = options.plan ?? (await planTask(job.task));
    updateJob(jobId, {
      planSummary: plan.summary,
      developerBrief: plan.developerBrief || undefined,
    });
    await onProgress(
      [
        `План: ${plan.summary}`,
        `Аналитик: ${plan.needAnalyst ? "да" : "нет"} · SEO: ${plan.needSeo ? "да" : "нет"}`,
        `Backend: ${plan.needBackend ? "да" : "нет"} · Frontend: ${plan.needFrontend ? "да" : "нет"} · Tester: ${plan.needTester ? "да" : "нет"} · Dev: ${plan.needDeveloper ? "да" : "нет"}`,
        plan.risks.length ? `Риски: ${plan.risks.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );

    const [analyst, seo] = await Promise.all([
      plan.needAnalyst && plan.analystBrief
        ? (async () => {
            await onProgress("📊 Аналитик работает…");
            return runAnalyst(plan.analystBrief);
          })()
        : Promise.resolve(undefined),
      plan.needSeo && plan.seoBrief
        ? (async () => {
            await onProgress("🔎 SEO работает…");
            return runSeo(plan.seoBrief);
          })()
        : Promise.resolve(undefined),
    ]);
    if (analyst) await onProgress("📊 Аналитик готов");
    if (seo) await onProgress("🔎 SEO готов");

    const [backend, frontend] = await Promise.all([
      plan.needBackend && plan.backendBrief
        ? (async () => {
            await onProgress("🧩 Backend думает…");
            return runBackend(plan.backendBrief);
          })()
        : Promise.resolve(undefined),
      plan.needFrontend && plan.frontendBrief
        ? (async () => {
            await onProgress("🎨 Frontend думает…");
            return runFrontend(plan.frontendBrief);
          })()
        : Promise.resolve(undefined),
    ]);
    if (backend) await onProgress("🧩 Backend готов");
    if (frontend) await onProgress("🎨 Frontend готов");

    let tester: string | undefined;
    if (plan.needTester && plan.testerBrief) {
      await onProgress("🧪 Tester готовит план…");
      tester = await runTester(plan.testerBrief);
      await onProgress("🧪 Tester готов");
    }

    await onProgress("🗣️ Команда обсуждает…");
    const debateNotes = await debate({
      task: job.task,
      plan,
      ...(analyst ? { analyst } : {}),
      ...(seo ? { seo } : {}),
      ...(backend ? { backend } : {}),
      ...(frontend ? { frontend } : {}),
      ...(tester ? { tester } : {}),
    });
    await onProgress("🗣️ Обсуждение завершено");

    const cursorBrief = buildCursorBrief(plan, {
      ...(debateNotes ? { debate: debateNotes } : {}),
      ...(backend ? { backend } : {}),
      ...(frontend ? { frontend } : {}),
      ...(tester ? { tester } : {}),
    });
    updateJob(jobId, { developerBrief: cursorBrief });

    let developer: string | undefined;
    const wantDev = plan.needDeveloper && Boolean(plan.developerBrief || cursorBrief);
    const canAuto = options.runDeveloperNow ?? config.devAuto;

    if (wantDev && canAuto) {
      await onProgress("💻 Разработчик уже делает…");
      developer = await runDeveloper(cursorBrief);
      await onProgress("💻 Разработчик закончил");
    } else if (wantDev) {
      updateJob(jobId, { status: "awaiting_dev" });
      const report = await synthesize({
        task: job.task,
        plan,
        ...(analyst ? { analyst } : {}),
        ...(seo ? { seo } : {}),
        ...(backend ? { backend } : {}),
        ...(frontend ? { frontend } : {}),
        ...(tester ? { tester } : {}),
        debate: debateNotes,
      });
      updateJob(jobId, { report });
      return {
        job: getJob(jobId)!,
        plan,
        report:
          report +
          "\n\n—\nНужен исполнитель кода. Напишите «да, запускай разработчика» или нажмите кнопку.",
        awaitingDev: true,
      };
    }

    await onProgress("🧾 Собираю ответ…");
    const report = await synthesize({
      task: job.task,
      plan,
      ...(analyst ? { analyst } : {}),
      ...(seo ? { seo } : {}),
      ...(backend ? { backend } : {}),
      ...(frontend ? { frontend } : {}),
      ...(tester ? { tester } : {}),
      debate: debateNotes,
      ...(developer ? { developer } : {}),
    });
    updateJob(jobId, { status: "done", report });
    return { job: getJob(jobId)!, plan, report, awaitingDev: false };
  } finally {
    setLlmWaitNotifier(null);
  }
}

export async function runPendingDeveloper(jobId: string, onProgress: ProgressFn): Promise<string> {
  const job = getJob(jobId);
  if (!job?.developerBrief) throw new Error("Нет ТЗ разработчика для этой задачи");
  setLlmWaitNotifier(async (msg) => {
    await onProgress(msg);
  });
  updateJob(jobId, { status: "running" });
  try {
    await onProgress("💻 Разработчик уже делает…");
    const developer = await runDeveloper(job.developerBrief);
    const report = await synthesize({
      task: job.task,
      plan: {
        summary: job.planSummary || job.task,
        needAnalyst: false,
        needSeo: false,
        needBackend: false,
        needFrontend: false,
        needTester: false,
        needDeveloper: true,
        analystBrief: "",
        seoBrief: "",
        backendBrief: "",
        frontendBrief: "",
        testerBrief: "",
        developerBrief: job.developerBrief,
        risks: [],
      },
      developer,
    });
    updateJob(jobId, { status: "done", report });
    return report;
  } finally {
    setLlmWaitNotifier(null);
  }
}
