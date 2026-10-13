import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCursorProxyEnv } from "./llm/proxyEnv.js";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

const allowedRaw = optional("TELEGRAM_ALLOWED_USER_IDS");
const allowedUserIds = allowedRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => Number(s))
  .filter((n) => Number.isFinite(n));

const llmProviderRaw = optional("LLM_PROVIDER", "cursor").toLowerCase();
const llmProvider =
  llmProviderRaw === "mistral" ||
  llmProviderRaw === "groq" ||
  llmProviderRaw === "gemini" ||
  llmProviderRaw === "cursor"
    ? llmProviderRaw
    : "cursor";

export const config = {
  telegramToken: required("TELEGRAM_TEAM_BOT_TOKEN"),
  telegramApiRoot: optional("TELEGRAM_API_BASE", "https://api.telegram.org").replace(/\/+$/, ""),
  telegramHttpProxy: optional("TELEGRAM_HTTP_PROXY"),
  /** Optional dedicated proxy for Groq/Mistral; falls back to TELEGRAM_HTTP_PROXY */
  llmHttpProxy: optional("LLM_HTTP_PROXY"),
  allowedUserIds,
  llmProvider: llmProvider as "gemini" | "mistral" | "groq" | "cursor",
  geminiApiKey: optional("GEMINI_API_KEY"),
  geminiModel: optional("GEMINI_MODEL", "gemini-2.0-flash"),
  mistralApiKey: optional("MISTRAL_API_KEY"),
  mistralModel: optional("MISTRAL_MODEL", "mistral-small-latest"),
  groqApiKey: optional("GROQ_API_KEY"),
  /** Free-tier friendly default on Groq */
  groqModel: optional("GROQ_MODEL", "openai/gpt-oss-20b"),
  cursorApiKey: optional("CURSOR_API_KEY"),
  cursorWorkspace: path.resolve(optional("CURSOR_WORKSPACE", process.cwd())),
  cursorModel: optional("CURSOR_MODEL", "composer-2.5"),
  /** local = edit mounted workspace; cloud = Cursor-hosted VM + GitHub repo */
  cursorRuntime: optional("CURSOR_RUNTIME", "local") === "cloud" ? "cloud" : "local",
  cursorRepoUrl: optional("CURSOR_REPO_URL", "https://github.com/AnLoG21/Vmeste.git"),
  cursorRepoRef: optional("CURSOR_REPO_REF", "main"),
  cursorAutoPr: optional("CURSOR_AUTO_PR", "0") === "1",
  /**
   * Force HTTP/1.1+SSE for local Cursor agent streams (default on).
   * Matches IDE «HTTP Compatibility Mode → HTTP/1.1» for VLESS/xray proxies.
   */
  cursorUseHttp1: optional("CURSOR_USE_HTTP1", "1") !== "0",
  /** Default on: conversational mode runs Cursor developer without a confirm button */
  devAuto: optional("DEV_AUTO", "1") !== "0",
  /** Parallel LLM calls (1 = safer for Groq free TPM) */
  llmMaxConcurrent: Math.max(1, Number(optional("LLM_MAX_CONCURRENT", "1")) || 1),
  /** How many times to retry after HTTP 429 */
  llmRateLimitRetries: Math.max(1, Number(optional("LLM_RATE_LIMIT_RETRIES", "8")) || 8),
};

export function assertConfig() {
  if (!config.allowedUserIds.length) {
    throw new Error("Set TELEGRAM_ALLOWED_USER_IDS to at least one numeric Telegram user id");
  }

  const cursorProxy = applyCursorProxyEnv(config.llmHttpProxy || config.telegramHttpProxy);
  if (cursorProxy) {
    console.log(`[agents-team] Cursor/Node HTTPS_PROXY=${cursorProxy} NODE_USE_ENV_PROXY=1`);
  } else if (config.llmProvider === "cursor" || config.cursorApiKey) {
    console.warn(
      "[agents-team] No TELEGRAM_HTTP_PROXY/LLM_HTTP_PROXY — Cursor API may fail with region/permission_denied on RU VPS"
    );
  }
  if (config.llmProvider === "mistral" && !config.mistralApiKey) {
    console.warn("[agents-team] LLM_PROVIDER=mistral but MISTRAL_API_KEY missing — roles will stub");
  }
  if (config.llmProvider === "groq" && !config.groqApiKey) {
    console.warn("[agents-team] LLM_PROVIDER=groq but GROQ_API_KEY missing — roles will stub");
  }
  if (config.llmProvider === "gemini" && !config.geminiApiKey) {
    console.warn("[agents-team] GEMINI_API_KEY missing — team brain will use stubs");
  }
  if (config.llmProvider === "cursor" && !config.cursorApiKey) {
    console.warn("[agents-team] LLM_PROVIDER=cursor but CURSOR_API_KEY missing — brain will stub");
  }
  if (!config.cursorApiKey) {
    console.warn("[agents-team] CURSOR_API_KEY missing — developer agent disabled");
  }
  const proxy = config.llmHttpProxy || config.telegramHttpProxy || "direct";
  console.log(
    `[agents-team] LLM provider: ${config.llmProvider} · Cursor runtime: ${config.cursorRuntime} (${proxy === "direct" ? "direct" : "via proxy"})`
  );
}
