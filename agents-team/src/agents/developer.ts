import { config } from "../config.js";
import {
  createCursorAgent,
  isCursorStartupError,
  runCursorPrompt,
} from "../llm/cursorAgent.js";

export async function runDeveloper(brief: string): Promise<string> {
  if (!config.cursorApiKey) {
    return "Разработчик недоступен: нет CURSOR_API_KEY";
  }

  const prompt = [
    "Ты разработчик в репозитории Vmeste.",
    "Выполни задачу аккуратно, минимальным диффом.",
    "Не коммить и не пушь, если в задаче явно не сказано.",
    "В конце: что сделано, какие файлы, как проверить.",
    "",
    brief,
  ].join("\n");

  let agent: Awaited<ReturnType<typeof createCursorAgent>> | undefined;
  try {
    agent = await createCursorAgent();
    return await runCursorPrompt(agent, prompt);
  } catch (err) {
    if (isCursorStartupError(err)) {
      const msg = err.message;
      if (/permission_denied|not available in your region/i.test(msg)) {
        return [
          "Разработчик Cursor недоступен: API блокирует регион VPS.",
          "Нужен рабочий HTTPS_PROXY (TELEGRAM_HTTP_PROXY) с выходом в разрешённую страну, либо запускать агентов не с RU IP.",
          `Детали: ${msg}`,
        ].join("\n");
      }
      return `Не удалось запустить Cursor SDK: ${msg}`;
    }
    throw err;
  } finally {
    if (agent) {
      try {
        await agent[Symbol.asyncDispose]();
      } catch {
        /* ignore */
      }
    }
  }
}
