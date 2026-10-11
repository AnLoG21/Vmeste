import { askGemini } from "../llm/gemini.js";
import { ROLE_PM, ROLE_SYNTH } from "./roles.js";

export type TeamPlan = {
  summary: string;
  needAnalyst: boolean;
  needSeo: boolean;
  needDeveloper: boolean;
  analystBrief: string;
  seoBrief: string;
  developerBrief: string;
  risks: string[];
};

function fallbackPlan(task: string): TeamPlan {
  const lower = task.toLowerCase();
  const needDeveloper = /код|баг|фикс|рефактор|css|react|api|деплой|commit|pr/.test(lower);
  const needSeo = /seo|сео|мета|сниппет|поисков|ранжир/.test(lower);
  return {
    summary: task.slice(0, 240),
    needAnalyst: true,
    needSeo: needSeo || !needDeveloper,
    needDeveloper,
    analystBrief: `Проанализируй задачу и предложи лучший путь:\n${task}`,
    seoBrief: needSeo || !needDeveloper ? `SEO-взгляд на задачу:\n${task}` : "",
    developerBrief: needDeveloper
      ? `В репозитории Vmeste выполни:\n${task}\nНе коммить без явной просьбы. Кратко опиши изменения.`
      : "",
    risks: [],
  };
}

export async function planTask(task: string): Promise<TeamPlan> {
  const raw = await askGemini(ROLE_PM, task);
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<TeamPlan>;
    const base = fallbackPlan(task);
    return {
      summary: String(parsed.summary || base.summary),
      needAnalyst: Boolean(parsed.needAnalyst ?? base.needAnalyst),
      needSeo: Boolean(parsed.needSeo ?? base.needSeo),
      needDeveloper: Boolean(parsed.needDeveloper ?? base.needDeveloper),
      analystBrief: String(parsed.analystBrief || base.analystBrief),
      seoBrief: String(parsed.seoBrief || base.seoBrief),
      developerBrief: String(parsed.developerBrief || base.developerBrief),
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    };
  } catch {
    return fallbackPlan(task);
  }
}

export async function synthesize(parts: {
  task: string;
  plan: TeamPlan;
  analyst?: string;
  seo?: string;
  developer?: string;
}): Promise<string> {
  const payload = [
    `Исходная задача:\n${parts.task}`,
    `План:\n${JSON.stringify(parts.plan, null, 2)}`,
    parts.analyst ? `Аналитик:\n${parts.analyst}` : "",
    parts.seo ? `SEO:\n${parts.seo}` : "",
    parts.developer ? `Разработчик:\n${parts.developer}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return askGemini(ROLE_SYNTH, payload);
}
