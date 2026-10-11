# Agents Team (Telegram)

Команда в Telegram: PM → аналитик + SEO (Gemini) → разработчик (Cursor SDK).

## Прод (VPS)

Сервис `agents_team` в `docker-compose.prod.yml` (profile `agents`), `network_mode: host`,
прокси `TELEGRAM_HTTP_PROXY=socks5h://127.0.0.1:1080` (ваш VLESS/xray).

Секреты пишутся на сервер из GitHub Actions (`scripts/write-agents-team-env.sh`) при деплое.
Нужны secrets: `TELEGRAM_TEAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`, `GEMINI_API_KEY`, `CURSOR_API_KEY`
(опционально `TELEGRAM_HTTP_PROXY`).

## Локальный старт

```bash
cd agents-team
cp .env.example .env   # Windows: copy .env.example .env
npm install
npm start
```

## Команды

- `/task …` — задача команде
- обычный текст — тоже задача
- `/status` — последние задачи
- `/dev <id>` — подтвердить запуск разработчика
- `DEV_AUTO=1` — разработчик без кнопки подтверждения

Задачи живут в памяти процесса: после рестарта бота старые id пропадут.

Если `getMe` зависает с `ETIMEDOUT` до `api.telegram.org`, поднимите Worker из `scripts/telegram-cloudflare-worker.js` и укажите `TELEGRAM_API_BASE` в `.env`.
