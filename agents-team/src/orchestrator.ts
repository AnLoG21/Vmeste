import { runAnalyst } from "./agents/analyst.js";
import { runDeveloper } from "./agents/developer.js";
import { planTask, synthesize, type TeamPlan } from "./agents/pm.js";
import { runSeo } from "./agents/seo.js";
import { config } from "./config.js";
import { getJob, updateJob, type Job } from "./store.js";

export type ProgressFn = (message: string) => Promise<void>;

export type OrchestratorResult = {
  job: Job;
  plan: TeamPlan;
  report: string;
  awaitingDev: boolean;
};

export async function runTeamTask(
  jobId: string,
  onProgress: ProgressFn,
  options: { runDeveloperNow?: boolean } = {}
): Promise<OrchestratorResult> {
  const job = getJob(jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);

  updateJob(jobId, { status: "running" });
  await onProgress("🧭 PM разбирает задачу…");
  const plan = await planTask(job.task);
  const planPatch: { planSummary: string; developerBrief?: string } = {
    planSummary: plan.summary,
  };
  if (plan.developerBrief) planPatch.developerBrief = plan.developerBrief;
  updateJob(jobId, planPatch);
  await onProgress(
    [
      `План: ${plan.summary}`,
      `Аналитик: ${plan.needAnalyst ? "да" : "нет"} · SEO: ${plan.needSeo ? "да" : "нет"} · Dev: ${plan.needDeveloper ? "да" : "нет"}`,
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

  let developer: string | undefined;
  const wantDev = plan.needDeveloper && Boolean(plan.developerBrief);
  const canAuto = options.runDeveloperNow || config.devAuto;

  if (wantDev && canAuto) {
    await onProgress("💻 Разработчик (Cursor SDK)…");
    developer = await runDeveloper(plan.developerBrief);
    await onProgress("💻 Разработчик закончил");
  } else if (wantDev) {
    updateJob(jobId, { status: "awaiting_dev" });
    const synthInput: Parameters<typeof synthesize>[0] = { task: job.task, plan };
    if (analyst) synthInput.analyst = analyst;
    if (seo) synthInput.seo = seo;
    const report = await synthesize(synthInput);
    updateJob(jobId, { report });
    return {
      job: getJob(jobId)!,
      plan,
      report:
        report +
        "\n\n—\nНужен разработчик. Нажмите «Запустить разработчика» или `/dev " +
        jobId +
        "`",
      awaitingDev: true,
    };
  }

  await onProgress("🧩 Собираю итоговый отчёт…");
  const synthInput: Parameters<typeof synthesize>[0] = { task: job.task, plan };
  if (analyst) synthInput.analyst = analyst;
  if (seo) synthInput.seo = seo;
  if (developer) synthInput.developer = developer;
  const report = await synthesize(synthInput);
  updateJob(jobId, { status: "done", report });
  return { job: getJob(jobId)!, plan, report, awaitingDev: false };
}

export async function runPendingDeveloper(jobId: string, onProgress: ProgressFn): Promise<string> {
  const job = getJob(jobId);
  if (!job?.developerBrief) throw new Error("Нет ТЗ разработчика для этой задачи");
  updateJob(jobId, { status: "running" });
  await onProgress("💻 Разработчик (Cursor SDK)…");
  const developer = await runDeveloper(job.developerBrief);
  const report = await synthesize({
    task: job.task,
    plan: {
      summary: job.planSummary || job.task,
      needAnalyst: false,
      needSeo: false,
      needDeveloper: true,
      analystBrief: "",
      seoBrief: "",
      developerBrief: job.developerBrief,
      risks: [],
    },
    developer,
  });
  updateJob(jobId, { status: "done", report });
  return report;
}
