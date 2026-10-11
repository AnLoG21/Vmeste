import { assertConfig } from "./config.js";
import { createBot } from "./bot.js";

assertConfig();
const bot = createBot();

bot.catch((err) => {
  console.error("[agents-team] bot error", err.error);
});

console.log("[agents-team] starting Telegram polling…");
await bot.start({
  onStart: (info) => console.log(`[agents-team] @${info.username} online`),
});
