# Agents Team (Telegram)

Команда в Telegram: PM → аналитик + SEO (Gemini) → разработчик (Cursor SDK).

## Быстрый старт

1. Создайте бота у [@BotFather](https://t.me/BotFather), скопируйте токен.
2. Узнайте свой id: напишите боту `/whoami` после временного ослабления ACL, либо через `@userinfobot`.
3. Ключи:
   - [Gemini API key](https://aistudio.google.com/apikey)
   - [Cursor API key](https://cursor.com/dashboard/integrations)
4. Скопируйте env и заполните:

```bash
cd agents-team
copy .env.example .env
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
