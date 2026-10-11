import { assertConfig, config } from "./config.js";
import { createBot } from "./bot.js";

assertConfig();
const bot = createBot();

bot.catch((err) => {
  console.error("[agents-team] bot error", err.error);
});

console.log("[agents-team] starting Telegram polling…");
console.log(
  `[agents-team] proxy=${config.telegramHttpProxy || "none"} apiRoot=${config.telegramApiRoot}`
);

try {
  const me = await bot.api.getMe();
  console.log(`[agents-team] getMe ok @${me.username} id=${me.id}`);
} catch (err) {
  console.error("[agents-team] getMe FAILED", err);
  process.exit(1);
}

await bot.start({
  onStart: (info) => console.log(`[agents-team] @${info.username} online`),
});
