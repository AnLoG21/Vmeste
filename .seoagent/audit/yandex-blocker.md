---
title: Yandex Webmaster blocker
date: 2026-11-24
status: resolved
resolved: 2026-11-24
---

# Яндекс Webmaster — блокер recrawl

## Статус
Токен был рабочий; на 2026-11-24 вечер: `INVALID_OAUTH_TOKEN` (истёк/отозван) — нужен свежий OAuth. До этого recrawl POST давал **HTTP 504** — retry после нового токена или ручной переобход в кабинете.

## Что сделано
- В OAuth-приложение «Вместе» добавлен Redirect URI `https://oauth.yandex.ru/verification_code` (prod callback’и не трогали).
- `YANDEX_WEBMASTER_TOKEN` в `~/.cursor/skills/yandex-webmaster/config/.env` (не в git).
- API: user_id OK, host `https://vsevmeste.space/` verified, daily_quota=10.

## Дальше
- Повторить: `scripts/recrawl.sh --host vsevmeste.space --action submit --url …`
- Или вручную: Вебмастер → Индексирование → Переобход.
- При истечении токена (~1 год): authorize с `redirect_uri=verification_code`.
