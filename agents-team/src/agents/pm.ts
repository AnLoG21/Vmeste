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

function looksLikeAction(task: string): boolean {
  return /сделай|улучши|поправ|исправ|внедри|добав|проверь.*(и|и сразу)|аудит.*(и|сразу)|реализу|почини|фик|баг/.test(
    task.toLowerCase()
  );
}

function fallbackPlan(task: string): TeamPlan {
  const lower = task.toLowerCase();
  const design = looksLikeDesign(task);
  const needBackend = /бэк|backend|api|django|миграц|celery|postgres|endpoint/.test(lower);
  const needFrontend =
    design || /фронт|frontend|ui|react|вёрст|верст|css|кнопк|страниц|анимац|календар/.test(lower);
  const needDeveloper =
    needBackend ||
    needFrontend ||
    looksLikeAction(task) ||
    /код|баг|фикс|рефактор|деплой|commit|pr|тест e2e|playwright|внедр/.test(lower);
  const needSeo = /seo|сео|мета|сниппет|поисков|ранжир/.test(lower);
  const needTester = needDeveloper || design || /тест|qa|регресс|баг/.test(lower);
  return {
    summary: task.slice(0, 240),
    needAnalyst: true,
    needSeo,
    needBackend: needBackend || (needDeveloper && !design),
    needFrontend: needFrontend || needDeveloper,
    needTester,
    needDeveloper,
    analystBrief: `Проанализируй задачу и предложи лучший путь:\n${task}`,
    seoBrief: needSeo ? `SEO-взгляд на задачу:\n${task}` : "",
    backendBrief: needBackend || (needDeveloper && !design) ? `Backend-план по задаче:\n${task}` : "",
    frontendBrief:
      needFrontend || needDeveloper
        ? `Frontend/UX-план по задаче (конкретные экраны и правки):\n${task}`
        : "",
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
}

function fallbackIntake(message: string, answeringClarification: boolean): IntakeResult {
  const lower = message.toLowerCase().trim();
  if (
    !answeringClarification &&
    /^(привет|здравств|хай|hello|hi|ку|йоу)[\s!.]*$/i.test(lower)
  ) {
    return {
      mode: "chat",
      reply:
        "Привет. Пишите обычным текстом — разберём, при необходимости уточним и сразу подключим нужные роли (аналитик, SEO, backend, frontend, tester, разработчик).",
      questions: [],
      task: "",
      plan: fallbackPlan(message),
    };
  }
  if (!answeringClarification && /что умеете|как работа|помощь|help/.test(lower)) {
    return {
      mode: "chat",
      reply:
        "Просто опишите задачу своими словами. Если чего-то не хватает — спрошу. Потом команда сама разберёт и сделает: план, UX/код при необходимости, отчёт в чат.",
      questions: [],
      task: "",
      plan: fallbackPlan(message),
    };
  }

  const design = looksLikeDesign(message);
  const vague =
    !answeringClarification &&
    design &&
    !/(лендинг|главн|календар|кабинет|провайдер|клиент|конкретн|внедр|сделай|улучши)/.test(lower);

  if (vague) {
    const questions = [
      "С чего начать: главная (лендинг), кабинет клиента, кабинет провайдера или календарь?",
      "Нужен только аудит с рекомендациями или сразу правки в коде?",
      "Важно в первую очередь десктоп или мобилка?",
    ];
    return {
      mode: "clarify",
      reply: ["Уточню коротко, чтобы не делать лишнего:", ...questions.map((q, i) => `${i + 1}) ${q}`)].join(
        "\n"
      ),
      questions,
      task: "",
      plan: fallbackPlan(message),
    };
  }

  const task = message;
  const plan = fallbackPlan(task);
  return {
    mode: "execute",
    reply: "Принял. Запускаю команду.",
    questions: [],
    task,
    plan,
  };
}

export async function intakeMessage(input: {
  message: string;
  history: string;
  answeringClarification: boolean;
  draftTask?: string;
}): Promise<IntakeResult> {
  const userPayload = [
    input.history ? `История:\n${input.history}` : "История: пусто",
    input.answeringClarification
      ? `Сейчас пользователь отвечает на уточнения. Черновик задачи:\n${input.draftTask || ""}`
      : "Это новое сообщение (не ответ на уточнения).",
    `Сообщение:\n${input.message}`,
  ].join("\n\n");

  const raw = await askLlm(ROLE_INTAKE, userPayload);
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    const merged = input.answeringClarification
      ? `${input.draftTask || ""}\n\nУточнения от заказчика:\n${input.message}`.trim()
      : input.message;
    return fallbackIntake(merged, input.answeringClarification);
  }

  const modeRaw = String(parsed.mode || "").toLowerCase();
  const mode: IntakeMode =
    modeRaw === "chat" || modeRaw === "clarify" || modeRaw === "execute"
      ? modeRaw
      : "execute";

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.map(String).filter(Boolean).slice(0, 3)
    : [];

  let task = String(parsed.task || "").trim();
  if (mode === "execute" && !task) {
    task = input.answeringClarification
      ? `${input.draftTask || ""}\n\nУточнения от заказчика:\n${input.message}`.trim()
      : input.message;
  }

  const plan = planFromParsed(parsed as Partial<TeamPlan>, task || input.message);
  let reply = String(parsed.reply || "").trim();
  if (!reply) {
    if (mode === "clarify") {
      reply = ["Уточню:", ...questions.map((q, i) => `${i + 1}) ${q}`)].join("\n");
    } else if (mode === "execute") {
      reply = "Принял. Запускаю команду.";
    } else {
      reply = "Слушаю — опишите, что нужно по «Вместе».";
    }
  }

  if (mode === "clarify" && !questions.length) {
    return fallbackIntake(
      input.answeringClarification
        ? `${input.draftTask || ""}\n\n${input.message}`
        : input.message,
      input.answeringClarification
    );
  }

  return { mode, reply, questions, task, plan };
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
