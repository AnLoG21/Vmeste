import { config } from "../config.js";
import { llmFetch } from "./http.js";
import { parseRetryAfterMs, withRateLimitRetry, type RetryHooks } from "./retry.js";

type MistralChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function askMistralOnce(system: string, user: string): Promise<string> {
  if (!config.mistralApiKey) {
    return [
      "[stub — нет MISTRAL_API_KEY]",
      `Роль: ${system.slice(0, 120)}…`,
      `Задача: ${user}`,
      "Подключите MISTRAL_API_KEY в agents-team/.env",
    ].join("\n");
  }

  const res = await llmFetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.mistralApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.mistralModel,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const retryHeader = res.headers.get("retry-after");
    const hintMs = parseRetryAfterMs(body, retryHeader);
    const hint = hintMs != null ? ` (retry_after_ms=${hintMs})` : "";
    throw new Error(`Mistral HTTP ${res.status}: ${body.slice(0, 500)}${hint}`);
  }

  const data = (await res.json()) as MistralChatResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Mistral response");
  return text;
}

export async function askMistral(
  system: string,
  user: string,
  hooks?: RetryHooks
): Promise<string> {
  return withRateLimitRetry("Mistral", () => askMistralOnce(system, user), {
    maxAttempts: config.llmRateLimitRetries,
    hooks,
  });
}
