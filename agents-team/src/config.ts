import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const llmProviderRaw = optional("LLM_PROVIDER", "gemini").toLowerCase();
const llmProvider =
  llmProviderRaw === "mistral" || llmProviderRaw === "groq" ? llmProviderRaw : "gemini";

export const config = {
  telegramToken: required("TELEGRAM_TEAM_BOT_TOKEN"),
  telegramApiRoot: optional("TELEGRAM_API_BASE", "https://api.telegram.org").replace(/\/+$/, ""),
  telegramHttpProxy: optional("TELEGRAM_HTTP_PROXY"),
  /** Optional dedicated proxy for Groq/Mistral; falls back to TELEGRAM_HTTP_PROXY */
  llmHttpProxy: optional("LLM_HTTP_PROXY"),
  allowedUserIds,
  llmProvider: llmProvider as "gemini" | "mistral" | "groq",
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
  cursorRuntime: optional("CURSOR_RUNTIME", "cloud") === "local" ? "local" : "cloud",
  cursorRepoUrl: optional("CURSOR_REPO_URL", "https://github.com/AnLoG21/Vmeste.git"),
  cursorRepoRef: optional("CURSOR_REPO_REF", "main"),
  cursorAutoPr: optional("CURSOR_AUTO_PR", "0") === "1",
  /** Default on: conversational mode runs Cursor developer without a confirm button */
  devAuto: optional("DEV_AUTO", "1") !== "0",
};

export function assertConfig() {
  if (!config.allowedUserIds.length) {
    throw new Error("Set TELEGRAM_ALLOWED_USER_IDS to at least one numeric Telegram user id");
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
  if (!config.cursorApiKey) {
    console.warn("[agents-team] CURSOR_API_KEY missing — developer agent disabled (brain can still run free)");
  }
  const proxy = config.llmHttpProxy || config.telegramHttpProxy || "direct";
  console.log(`[agents-team] LLM provider: ${config.llmProvider} (${proxy === "direct" ? "direct" : "via proxy"})`);
}
