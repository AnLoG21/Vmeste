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

export const config = {
  telegramToken: required("TELEGRAM_TEAM_BOT_TOKEN"),
  allowedUserIds,
  geminiApiKey: optional("GEMINI_API_KEY"),
  geminiModel: optional("GEMINI_MODEL", "gemini-2.0-flash"),
  cursorApiKey: optional("CURSOR_API_KEY"),
  cursorWorkspace: path.resolve(optional("CURSOR_WORKSPACE", process.cwd())),
  cursorModel: optional("CURSOR_MODEL", "composer-2.5"),
  devAuto: optional("DEV_AUTO", "0") === "1",
};

export function assertConfig() {
  if (!config.allowedUserIds.length) {
    throw new Error("Set TELEGRAM_ALLOWED_USER_IDS to at least one numeric Telegram user id");
  }
  if (!config.geminiApiKey) {
    console.warn("[agents-team] GEMINI_API_KEY missing — PM/analyst/SEO will use a stub planner");
  }
  if (!config.cursorApiKey) {
    console.warn("[agents-team] CURSOR_API_KEY missing — developer agent disabled");
  }
}
