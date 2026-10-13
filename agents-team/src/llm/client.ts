import { config } from "../config.js";
import { askCursor } from "./cursor.js";
import { askGemini } from "./gemini.js";
import { askGroq } from "./groq.js";
import { askMistral } from "./mistral.js";
import { enqueueLlm, setLlmMaxConcurrent } from "./queue.js";
import type { RetryHooks } from "./retry.js";

setLlmMaxConcurrent(config.llmMaxConcurrent);

type WaitNotifier = (message: string) => void | Promise<void>;

let waitNotifier: WaitNotifier | null = null;

/** Bot/orchestrator can show “waiting for rate limit” in Telegram. */
export function setLlmWaitNotifier(fn: WaitNotifier | null) {
  waitNotifier = fn;
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
    if (config.llmProvider === "cursor") return askCursor(system, user);
    if (config.llmProvider === "groq") return askGroq(system, user, hooks);
    if (config.llmProvider === "mistral") return askMistral(system, user, hooks);
    return askGemini(system, user);
  });
}
