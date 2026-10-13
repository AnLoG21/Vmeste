# Agents Team (Telegram)

Команда в Telegram для «Вместе»:

**PM → аналитик + SEO → backend + frontend → tester → обсуждение → разработчик (Cursor SDK)**

Мозг ролей: **Cursor** (`LLM_PROVIDER=cursor`, по умолчанию) — тот же SDK, с контекстом репозитория и историей Telegram-чата (`Agent.resume` на чат).  
Альтернативы без Cursor-лимитов: `groq` / `mistral` / `gemini`.  
Код (роль разработчика): отдельный Cursor-агент (`CURSOR_API_KEY`).

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

## Бесплатно и без оплаты (реалистично)

| Вариант | Деньги | Минус |
|--------|--------|--------|
| **Groq free** | $0 при лимитах | лимиты RPM/TPM, условия могут меняться |
| **Gemini free** | $0 при квоте | квоты Google |
| **Mistral Free mode** | $0 в included usage | лимиты org |
| **Ollama локально** | $0 всегда | нужен CPU/RAM/GPU на VPS |

`LLM_PROVIDER=cursor` даёт лучший контекст (код + чат), но тратит Cursor. Для бесплатного мозга: `LLM_PROVIDER=groq`. Разработчик по умолчанию стартует сам (`DEV_AUTO=1`).

### Groq

1. [console.groq.com](https://console.groq.com) → API Keys  
2. В `.env`:
   ```env
   LLM_PROVIDER=groq
   GROQ_API_KEY=...
   GROQ_MODEL=openai/gpt-oss-20b
   ```
3. Если ключ светился в чате — **сразу revoke** и сделай новый.

### Mistral Free mode

[console.mistral.ai](https://console.mistral.ai) → API Keys, карта не обязательна в Free mode.

## Как пользоваться

Пишите **обычным текстом** — без `/task`.

1. PM читает сообщение (с историей чата).
2. Если не хватает деталей — **спрашивает** (1–3 вопроса) и ждёт ответ.
3. Иначе сразу гоняет роли: аналитик / SEO / backend / frontend / tester → обсуждение → **разработчик (Cursor)**, если нужен код.
4. Итог приходит в тот же чат.

Опционально:
- `/status` — последние задачи
- `/whoami` — ваш Telegram id
- `/task …` и `/dev …` — ещё работают, но не обязательны
- `DEV_AUTO=0` — разработчик только после «да» / кнопки (по умолчанию `1`)
- `LLM_PROVIDER=cursor` — мозг на Cursor + история чата. На RU VPS: `HTTPS_PROXY` + **`CURSOR_USE_HTTP1=1`** (аналог IDE HTTP/1.1 — VLESS часто ломает HTTP/2). Если Cursor всё равно падает — мозг уходит на Groq.
- `CURSOR_RUNTIME=local` по умолчанию на проде (репозиторий в `/opt/vmeste`)
- при HTTP 429 (Groq/Mistral) бот **ждёт** и повторяет; `LLM_MAX_CONCURRENT=1`

Задачи и уточнения живут в памяти процесса: после рестарта бота история сессии сбросится.

Если `getMe` зависает с `ETIMEDOUT` до `api.telegram.org`, поднимите Worker из `scripts/telegram-cloudflare-worker.js` и укажите `TELEGRAM_API_BASE` в `.env`.
