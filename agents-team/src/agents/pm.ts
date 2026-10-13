import { askLlm } from "../llm/client.js";
import { ROLE_DEBATE, ROLE_PM, ROLE_SYNTH } from "./roles.js";

export type TeamPlan = {
  summary: string;
  needAnalyst: boolean;
  needSeo: boolean;
  needBackend: boolean;
  needFrontend: boolean;
  needTester: boolean;
  needDeveloper: boolean;
  analystBrief: string;
  seoBrief: string;
  backendBrief: string;
  frontendBrief: string;
  testerBrief: string;
  developerBrief: string;
  risks: string[];
};

function fallbackPlan(task: string): TeamPlan {
  const lower = task.toLowerCase();
  const needBackend = /бэк|backend|api|django|миграц|celery|postgres|endpoint/.test(lower);
  const needFrontend = /фронт|frontend|ui|react|вёрст|css|кнопк|страниц/.test(lower);
  const needDeveloper =
    needBackend ||
    needFrontend ||
    /код|баг|фикс|рефактор|деплой|commit|pr|тест e2e|playwright/.test(lower);
  const needSeo = /seo|сео|мета|сниппет|поисков|ранжир/.test(lower);
  const needTester = needDeveloper || /тест|qa|регресс|баг/.test(lower);
  return {
    summary: task.slice(0, 240),
    needAnalyst: true,
    needSeo: needSeo || !needDeveloper,
    needBackend: needBackend || needDeveloper,
    needFrontend: needFrontend || needDeveloper,
    needTester,
    needDeveloper,
    analystBrief: `Проанализируй задачу и предложи лучший путь:\n${task}`,
    seoBrief: needSeo || !needDeveloper ? `SEO-взгляд на задачу:\n${task}` : "",
    backendBrief: needBackend || needDeveloper ? `Backend-план по задаче:\n${task}` : "",
    frontendBrief: needFrontend || needDeveloper ? `Frontend-план по задаче:\n${task}` : "",
    testerBrief: needTester ? `Тест-план по задаче:\n${task}` : "",
    developerBrief: needDeveloper
      ? `В репозитории Vmeste выполни:\n${task}\nНе коммить без явной просьбы. Кратко опиши изменения.`
      : "",
    risks: [],
  };
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

export async function planTask(task: string): Promise<TeamPlan> {
  const raw = await askLlm(ROLE_PM, task);
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<TeamPlan>;
    const base = fallbackPlan(task);
    return {
      summary: String(parsed.summary || base.summary),
      needAnalyst: asBool(parsed.needAnalyst, base.needAnalyst),
      needSeo: asBool(parsed.needSeo, base.needSeo),
      needBackend: asBool(parsed.needBackend, base.needBackend),
      needFrontend: asBool(parsed.needFrontend, base.needFrontend),
      needTester: asBool(parsed.needTester, base.needTester),
      needDeveloper: asBool(parsed.needDeveloper, base.needDeveloper),
      analystBrief: String(parsed.analystBrief || base.analystBrief),
      seoBrief: String(parsed.seoBrief || base.seoBrief),
      backendBrief: String(parsed.backendBrief || base.backendBrief),
      frontendBrief: String(parsed.frontendBrief || base.frontendBrief),
      testerBrief: String(parsed.testerBrief || base.testerBrief),
      developerBrief: String(parsed.developerBrief || base.developerBrief),
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    };
  } catch {
    return fallbackPlan(task);
  }
}

export async function debate(parts: {
  task: string;
  plan: TeamPlan;
  analyst?: string;
  seo?: string;
  backend?: string;
  frontend?: string;
  tester?: string;
}): Promise<string> {
  const payload = [
    `Задача:\n${parts.task}`,
    `План PM:\n${JSON.stringify(parts.plan, null, 2)}`,
    parts.analyst ? `Аналитик:\n${parts.analyst}` : "",
    parts.seo ? `SEO:\n${parts.seo}` : "",
    parts.backend ? `Backend:\n${parts.backend}` : "",
    parts.frontend ? `Frontend:\n${parts.frontend}` : "",
    parts.tester ? `Tester:\n${parts.tester}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return askLlm(ROLE_DEBATE, payload);
}

export async function synthesize(parts: {
  task: string;
  plan: TeamPlan;
  analyst?: string;
  seo?: string;
  backend?: string;
  frontend?: string;
  tester?: string;
  debate?: string;
  developer?: string;
}): Promise<string> {
  const payload = [
    `Исходная задача:\n${parts.task}`,
    `План:\n${JSON.stringify(parts.plan, null, 2)}`,
    parts.analyst ? `Аналитик:\n${parts.analyst}` : "",
    parts.seo ? `SEO:\n${parts.seo}` : "",
    parts.backend ? `Backend:\n${parts.backend}` : "",
    parts.frontend ? `Frontend:\n${parts.frontend}` : "",
    parts.tester ? `Tester:\n${parts.tester}` : "",
    parts.debate ? `Обсуждение команды:\n${parts.debate}` : "",
    parts.developer ? `Исполнитель кода (Cursor):\n${parts.developer}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return askLlm(ROLE_SYNTH, payload);
}
