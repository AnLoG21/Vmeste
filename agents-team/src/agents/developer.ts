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
      return `Не удалось запустить Cursor SDK: ${err.message}`;
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
