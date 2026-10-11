import { Agent, CursorAgentError } from "@cursor/sdk";
import { config } from "../config.js";

export async function runDeveloper(brief: string): Promise<string> {
  if (!config.cursorApiKey) {
    return "Разработчик недоступен: нет CURSOR_API_KEY в agents-team/.env";
  }

  await using agent = await Agent.create({
    apiKey: config.cursorApiKey,
    model: { id: config.cursorModel },
    local: { cwd: config.cursorWorkspace },
  });

  const prompt = [
    "Ты разработчик в репозитории Vmeste.",
    "Выполни задачу аккуратно, минимальным диффом.",
    "Не коммить и не пушь, если в задаче явно не сказано.",
    "В конце: что сделано, какие файлы, как проверить.",
    "",
    brief,
  ].join("\n");

  try {
    const run = await agent.send(prompt);
    const result = await run.wait();
    if (result.status === "error") {
      return `Разработчик завершился с ошибкой (run ${result.id}). Смотри логи Cursor.`;
    }
    const text = typeof result.result === "string" ? result.result : JSON.stringify(result.result ?? "");
    return text?.trim() || `Готово (run ${result.id}, agent ${agent.agentId}).`;
  } catch (err) {
    if (err instanceof CursorAgentError) {
      return `Не удалось запустить Cursor SDK: ${err.message}`;
    }
    throw err;
  }
}
