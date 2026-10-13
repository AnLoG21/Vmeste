# Agents Team (Telegram)

Команда в Telegram для «Вместе»:

**PM → аналитик + SEO → backend + frontend → tester → обсуждение → разработчик (Cursor SDK)**

Мозг ролей (кроме кода): Gemini или Mistral (`LLM_PROVIDER`).  
Код: Cursor SDK (`CURSOR_API_KEY`).

## Прод (VPS)

Сервис `agents_team` в `docker-compose.prod.yml` (profile `agents`), `network_mode: host`,
прокси `TELEGRAM_HTTP_PROXY` (VLESS/xray).

Секреты пишутся на сервер из GitHub Actions (`scripts/write-agents-team-env.sh`) при деплое.
Нужны secrets: `TELEGRAM_TEAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`, `GEMINI_API_KEY` или `MISTRAL_API_KEY`, `CURSOR_API_KEY`
(опционально `TELEGRAM_HTTP_PROXY`, `LLM_PROVIDER`).

## Локальный старт

```bash
cd agents-team
cp .env.example .env   # Windows: copy .env.example .env
npm install
npm start
```

## Бесплатный Mistral API

1. Зайди на [console.mistral.ai](https://console.mistral.ai)
2. Войди / зарегистрируйся
3. Слева **API Keys** → **Create new key**
4. Скопируй ключ сразу (показывается один раз)
5. В `.env`:
   ```env
   LLM_PROVIDER=mistral
   MISTRAL_API_KEY=...
   MISTRAL_MODEL=mistral-small-latest
   ```

Free mode по умолчанию, карта не нужна, но есть лимиты (RPS / tokens). Подробнее: [Mistral docs](https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key).

## Команды бота

- `/task …` — задача команде
- обычный текст — тоже задача
- `/status` — последние задачи
- `/dev <id>` — подтвердить запуск разработчика
- `DEV_AUTO=1` — разработчик без кнопки подтверждения

Задачи живут в памяти процесса: после рестарта бота старые id пропадут.

Если `getMe` зависает с `ETIMEDOUT` до `api.telegram.org`, поднимите Worker из `scripts/telegram-cloudflare-worker.js` и укажите `TELEGRAM_API_BASE` в `.env`.
