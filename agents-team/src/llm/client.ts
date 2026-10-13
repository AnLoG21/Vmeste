import { config } from "../config.js";
import { askCursor } from "./cursor.js";
import { askGemini } from "./gemini.js";
import { askGroq } from "./groq.js";
import { askMistral } from "./mistral.js";
import { isCursorRegionError } from "./proxyEnv.js";
import { enqueueLlm, setLlmMaxConcurrent } from "./queue.js";
import type { RetryHooks } from "./retry.js";

setLlmMaxConcurrent(config.llmMaxConcurrent);

type WaitNotifier = (message: string) => void | Promise<void>;

let waitNotifier: WaitNotifier | null = null;
/** After region block, keep using fallback for this process */
let cursorBrainBlocked = false;
let fellBackOnce = false;

/** Bot/orchestrator can show “waiting for rate limit” in Telegram. */
export function setLlmWaitNotifier(fn: WaitNotifier | null) {
  waitNotifier = fn;
}

async function fallbackBrain(
  system: string,
  user: string,
  hooks: RetryHooks
): Promise<string> {
  if (config.groqApiKey) return askGroq(system, user, hooks);
  if (config.mistralApiKey) return askMistral(system, user, hooks);
  if (config.geminiApiKey) return askGemini(system, user);
  throw new Error(
    "Cursor недоступен в регионе, а запасной LLM (GROQ/MISTRAL/GEMINI) не настроен"
  );
}

/** Team brain for non-coding roles (PM, analyst, SEO, debate, briefs). */
export async function askLlm(system: string, user: string): Promise<string> {
  const hooks: RetryHooks = {
    onWait: async (seconds, attempt) => {
      const msg = `⏳ Лимит API, жду ~${seconds}с и продолжаю (попытка ${attempt})…`;
      console.warn(`[agents-team] ${msg}`);
      try {
        await waitNotifier?.(msg);
      } catch {
        /* ignore notify failures */
      }
    },
  };

  return enqueueLlm(async () => {
    if (config.llmProvider === "cursor" && !cursorBrainBlocked) {
      try {
        return await askCursor(system, user);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isCursorRegionError(message)) {
          cursorBrainBlocked = true;
          console.warn(`[agents-team] Cursor brain blocked by region: ${message}`);
          if (!fellBackOnce) {
            fellBackOnce = true;
            try {
              await waitNotifier?.(
                "⚠️ Cursor API недоступен с этого VPS (регион). Мозг команды переключаю на Groq/запасной LLM; разработчик Cursor тоже может не стартовать, пока прокси не пускает api2.cursor.sh."
              );
            } catch {
              /* ignore */
            }
          }
          return fallbackBrain(system, user, hooks);
        }
        throw err;
      }
    }

    if (config.llmProvider === "cursor" && cursorBrainBlocked) {
      return fallbackBrain(system, user, hooks);
    }
    if (config.llmProvider === "groq") return askGroq(system, user, hooks);
    if (config.llmProvider === "mistral") return askMistral(system, user, hooks);
    return askGemini(system, user);
  });
}
