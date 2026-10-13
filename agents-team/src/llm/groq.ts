import { config } from "../config.js";
import { llmFetch } from "./http.js";
import { parseRetryAfterMs, withRateLimitRetry, type RetryHooks } from "./retry.js";

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function askGroqOnce(system: string, user: string): Promise<string> {
  if (!config.groqApiKey) {
    return [
      "[stub — нет GROQ_API_KEY]",
      `Роль: ${system.slice(0, 120)}…`,
      `Задача: ${user}`,
      "Подключите GROQ_API_KEY в agents-team/.env",
    ].join("\n");
  }

  const res = await llmFetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const retryHeader =
      res.headers.get("retry-after") ||
      res.headers.get("x-ratelimit-reset-tokens") ||
      res.headers.get("x-ratelimit-reset-requests");
    const hintMs = parseRetryAfterMs(body, retryHeader);
    const hint = hintMs != null ? ` (retry_after_ms=${hintMs})` : "";
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 500)}${hint}`);
  }

  const data = (await res.json()) as GroqChatResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Groq response");
  return text;
}

export async function askGroq(
  system: string,
  user: string,
  hooks?: RetryHooks
): Promise<string> {
  return withRateLimitRetry("Groq", () => askGroqOnce(system, user), {
    maxAttempts: config.llmRateLimitRetries,
    hooks,
  });
}
