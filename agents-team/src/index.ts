import { assertConfig, config } from "./config.js";
import { createBot } from "./bot.js";
import { ensureCursorHttp1 } from "./llm/cursorAgent.js";

assertConfig();
if (config.cursorApiKey) {
  ensureCursorHttp1();
}
const bot = createBot();

bot.catch((err) => {
  console.error("[agents-team] bot error", err.error);
});

console.log("[agents-team] starting Telegram polling…");
console.log(
  `[agents-team] proxy=${config.telegramHttpProxy || "none"} apiRoot=${config.telegramApiRoot}`
);

async function waitForTelegram(maxAttempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const me = await bot.api.getMe();
      console.log(`[agents-team] getMe ok @${me.username} id=${me.id}`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[agents-team] getMe attempt ${attempt}/${maxAttempts} failed: ${message}`);
      await new Promise((r) => setTimeout(r, Math.min(60_000, 5_000 * attempt)));
    }
  }
  throw new Error("Telegram API unreachable after retries — check xray/TELEGRAM_HTTP_PROXY");
}

await waitForTelegram();
await bot.start({
  onStart: (info) => console.log(`[agents-team] @${info.username} online`),
});
