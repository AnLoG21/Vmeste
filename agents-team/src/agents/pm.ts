import { askLlm } from "../llm/client.js";
import { ROLE_DEBATE, ROLE_INTAKE, ROLE_PM, ROLE_SYNTH } from "./roles.js";

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

export type IntakeMode = "chat" | "clarify" | "execute";

export type IntakeResult = {
  mode: IntakeMode;
  reply: string;
  questions: string[];
  task: string;
  plan: TeamPlan;
};

function looksLikeDesign(task: string): boolean {
  return /дизайн|ux|ui|красот|лаконич|анимац|календар|лендинг|главн(ая|ой)|страниц|вёрст|верст|интерфейс|мобил/.test(
    task.toLowerCase()
  );
}

function looksLikeAuditOnly(task: string): boolean {
  return /аудит|рекомендац|сначала аудит|только аудит|посмотрим|без внедр|не внедр/.test(
    task.toLowerCase()
  );
}

function looksLikeImplement(task: string): boolean {
  return /сделай|улучши|поправ|исправ|внедри|добав|реализу|почини|фик|баг|сразу правк/.test(
    task.toLowerCase()
  );
}

function userDefersToTeam(text: string): boolean {
  return /на ваше усмотрение|доверяю|как считаете|сколько потребуется|на ваше|сами решите|все страниц|все модул|^все$|^всё$/i.test(
    text.trim()
  );
}

function fallbackPlan(task: string): TeamPlan {
  const lower = task.toLowerCase();
  const design = looksLikeDesign(task);
  const auditOnly = looksLikeAuditOnly(task) && !looksLikeImplement(task);
  const needBackend = /бэк|backend|api|django|миграц|celery|postgres|endpoint/.test(lower);
  const needFrontend =
    design || /фронт|frontend|ui|react|вёрст|верст|css|кнопк|страниц|анимац|календар/.test(lower);
  const needDeveloper =
    !auditOnly &&
    (needBackend ||
      looksLikeImplement(task) ||
      /код|баг|фикс|рефактор|деплой|commit|pr|тест e2e|playwright|внедр/.test(lower) ||
      (needFrontend && !design));
  const needSeo = /seo|сео|мета|сниппет|поисков|ранжир/.test(lower);
  const needTester = needDeveloper || design || /тест|qa|регресс|баг|аудит/.test(lower);

  const frontendBrief = needFrontend
    ? auditOnly
      ? `UX/UI-аудит платформы Vmeste по коду frontend/: лендинг/главная, кабинеты, календарь и ключевые модули. Критерии: современные стандарты, красота, лаконичность, анимации где уместно, удобство. Дай конкретный список находок по экранам/файлам и топ приоритетных улучшений. Без внедрения кода.\n${task}`
      : `Frontend/UX-план по задаче (конкретные экраны и правки):\n${task}`
    : "";

  return {
    summary: task.slice(0, 240),
    needAnalyst: true,
    needSeo,
    needBackend: needBackend || (needDeveloper && !design),
    needFrontend: needFrontend || needDeveloper,
    needTester,
    needDeveloper,
    analystBrief: auditOnly
      ? `Продуктовый UX-аудит: цели, критерии красоты/лаконичности, приоритеты модулей (главная → календарь → остальные), метрики успеха. Без внедрения.\n${task}`
      : `Проанализируй задачу и предложи лучший путь:\n${task}`,
    seoBrief: needSeo ? `SEO-взгляд на задачу:\n${task}` : "",
    backendBrief: needBackend || (needDeveloper && !design) ? `Backend-план по задаче:\n${task}` : "",
    frontendBrief,
    testerBrief: needTester
      ? auditOnly
        ? `Чеклист визуального/UX ревью: доступность, мобилка, иерархия, календарь. Без автотестов кода.\n${task}`
        : `Тест-план по задаче:\n${task}`
      : "",
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

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function planFromParsed(parsed: Partial<TeamPlan>, task: string): TeamPlan {
  const base = fallbackPlan(task);
  const plan = {
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
  // Audit-first never needs Cursor unless user also asked to implement
  if (looksLikeAuditOnly(task) && !looksLikeImplement(task)) {
    plan.needDeveloper = false;
    plan.developerBrief = "";
  }
  return plan;
}

function buildExecute(task: string, reply = "Принял. Запускаю команду — без лишних вопросов."): IntakeResult {
  return {
    mode: "execute",
    reply,
    questions: [],
    task,
    plan: fallbackPlan(task),
  };
}

function fallbackIntake(
  message: string,
  answeringClarification: boolean,
  clarifyRoundsAlready = 0
): IntakeResult {
  const lower = message.toLowerCase().trim();
  if (
    !answeringClarification &&
    /^(привет|здравств|хай|hello|hi|ку|йоу)[\s!.]*$/i.test(lower)
  ) {
    return {
      mode: "chat",
      reply:
        "Привет. Пишите задачу обычным текстом — один раз уточню при необходимости и сразу работаю.",
      questions: [],
      task: "",
      plan: fallbackPlan(message),
    };
  }
  if (!answeringClarification && /что умеете|как работа|помощь|help/.test(lower)) {
    return {
      mode: "chat",
      reply:
        "Опишите задачу. Спрошу максимум один раз, потом команда сделает аудит/план/код по смыслу.",
      questions: [],
      task: "",
      plan: fallbackPlan(message),
    };
  }

  if (answeringClarification || clarifyRoundsAlready >= 1 || userDefersToTeam(message)) {
    return buildExecute(message);
  }

  const design = looksLikeDesign(message);
  const hasScope =
    /лендинг|главн|календар|кабинет|провайдер|клиент|все|всё|платформ|модул|аудит|внедр|сделай|улучши/.test(
      lower
    );

  // Design with no scope at all — one short clarify; otherwise execute
  if (design && !hasScope && !looksLikeAuditOnly(message)) {
    const questions = [
      "Смотрим всю платформу или сначала главную + календарь?",
      "Сейчас только аудит в чат или сразу правки в коде?",
    ];
    return {
      mode: "clarify",
      reply: ["Ок, один уточняющий раунд:", ...questions.map((q, i) => `${i + 1}) ${q}`)].join("\n"),
      questions,
      task: "",
      plan: fallbackPlan(message),
    };
  }

  return buildExecute(message);
}

function forceExecuteFromAnswer(draftTask: string | undefined, message: string): IntakeResult {
  const task = `${draftTask || ""}\n\nУточнения от заказчика:\n${message}`.trim();
  return buildExecute(task, "Достаточно. Запускаю аудит/работу команды.");
}

export async function intakeMessage(input: {
  message: string;
  history: string;
  answeringClarification: boolean;
  draftTask?: string;
  /** Already asked clarify N times for this draft — if >=1, must execute */
  clarifyRoundsAlready?: number;
}): Promise<IntakeResult> {
  const rounds = input.clarifyRoundsAlready ?? 0;

  // Hard stop: never clarify twice; answers always execute
  if (input.answeringClarification || rounds >= 1) {
    return forceExecuteFromAnswer(
      input.draftTask,
      input.answeringClarification ? input.message : `${input.draftTask || ""}\n${input.message}`
    );
  }

  if (userDefersToTeam(input.message) && looksLikeDesign(input.history + "\n" + input.message)) {
    const task = input.draftTask
      ? `${input.draftTask}\n\nУточнения:\n${input.message}`
      : input.message;
    return buildExecute(task);
  }

  const userPayload = [
    input.history ? `История:\n${input.history}` : "История: пусто",
    "Это новое сообщение. Уточнять можно только если совсем нельзя начать. Сроки/формат/бренд-гайд НЕ спрашивать.",
    `Сообщение:\n${input.message}`,
  ].join("\n\n");

  const raw = await askLlm(ROLE_INTAKE, userPayload);
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return fallbackIntake(input.message, false, rounds);
  }

  let modeRaw = String(parsed.mode || "").toLowerCase();
  let mode: IntakeMode =
    modeRaw === "chat" || modeRaw === "clarify" || modeRaw === "execute"
      ? modeRaw
      : "execute";

  // Soft work request + deferral language → execute
  if (mode === "clarify" && (userDefersToTeam(input.message) || looksLikeAuditOnly(input.message))) {
    mode = "execute";
  }

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.map(String).filter(Boolean).slice(0, 2)
    : [];

  let task = String(parsed.task || "").trim();
  if (mode === "execute" && !task) {
    task = input.message;
  }

  if (mode === "clarify" && !questions.length) {
    return fallbackIntake(input.message, false, rounds);
  }

  if (mode === "execute") {
    const plan = planFromParsed(parsed as Partial<TeamPlan>, task);
    return {
      mode: "execute",
      reply: String(parsed.reply || "Принял. Запускаю команду.").trim() || "Принял. Запускаю команду.",
      questions: [],
      task,
      plan,
    };
  }

  if (mode === "chat") {
    return {
      mode: "chat",
      reply: String(parsed.reply || "Слушаю.").trim(),
      questions: [],
      task: "",
      plan: fallbackPlan(input.message),
    };
  }

  return {
    mode: "clarify",
    reply:
      String(parsed.reply || "").trim() ||
      ["Уточню один раз:", ...questions.map((q, i) => `${i + 1}) ${q}`)].join("\n"),
    questions,
    task: "",
    plan: planFromParsed(parsed as Partial<TeamPlan>, input.message),
  };
}

export async function planTask(task: string): Promise<TeamPlan> {
  const raw = await askLlm(ROLE_PM, task);
  const parsed = parseJsonObject(raw);
  if (!parsed) return fallbackPlan(task);
  return planFromParsed(parsed as Partial<TeamPlan>, task);
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
