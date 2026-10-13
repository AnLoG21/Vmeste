import { getChatContext } from "../chatContext.js";
import { formatHistory, getConversation } from "../conversation.js";
import { config } from "../config.js";
import {
  isCursorStartupError,
  resumeOrCreateCursorAgent,
  runCursorPrompt,
} from "./cursorAgent.js";

/**
 * Team brain via Cursor SDK: one agent per Telegram chat (resume),
 * with that chat's history injected into every turn. Read-only by prompt.
 */
export async function askCursor(system: string, user: string): Promise<string> {
  if (!config.cursorApiKey) {
    return [
      "[stub — нет CURSOR_API_KEY]",
      `Роль: ${system.slice(0, 120)}…`,
      `Задача: ${user}`,
      "Подключите CURSOR_API_KEY для LLM_PROVIDER=cursor",
    ].join("\n");
  }

  const chat = getChatContext();
  const conv = chat ? getConversation(chat.chatId, chat.userId) : undefined;
  const history = (conv ? formatHistory(conv, 16) : chat?.history || "").trim();

  const prompt = [
    "Ты участник продуктовой команды «Вместе» в Telegram.",
    "Отвечай по-русски. Сейчас ты выполняешь роль ниже.",
    "",
    "ЖЁСТКО: НЕ меняй файлы, НЕ коммить, НЕ создавай PR, НЕ запускай деплой.",
    "Только текстовый ответ по роли. Если нужен JSON — верни чистый JSON без markdown-ограждений.",
    "",
    "## Роль / system",
    system,
    history ? `\n## История этого Telegram-чата\n${history}` : "",
    "",
    "## Текущий запрос",
    user,
  ]
    .filter(Boolean)
    .join("\n");

  const attempt = async (agentId?: string) => {
    let agent: Awaited<ReturnType<typeof resumeOrCreateCursorAgent>> | undefined;
    try {
      agent = await resumeOrCreateCursorAgent(agentId);
      if (conv) {
        conv.cursorAgentId = agent.agentId;
        conv.updatedAt = Date.now();
      }
      return await runCursorPrompt(agent, prompt);
    } finally {
      if (agent) {
        try {
          await agent[Symbol.asyncDispose]();
        } catch {
          /* ignore */
        }
      }
    }
  };

  try {
    return await attempt(conv?.cursorAgentId);
  } catch (firstErr) {
    // Stale/broken local agent after proxy blip — retry once with a fresh agent
    if (conv?.cursorAgentId) {
      console.warn(
        `[agents-team] Cursor attempt failed, clearing agent ${conv.cursorAgentId} and retrying once`
      );
      conv.cursorAgentId = undefined;
      try {
        return await attempt(undefined);
      } catch (secondErr) {
        if (isCursorStartupError(secondErr)) {
          throw new Error(`Cursor HTTP/startup: ${secondErr.message}`);
        }
        throw secondErr;
      }
    }
    if (isCursorStartupError(firstErr)) {
      throw new Error(`Cursor HTTP/startup: ${firstErr.message}`);
    }
    throw firstErr;
  }
}
