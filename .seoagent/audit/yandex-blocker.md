---
title: Yandex Webmaster blocker
date: 2026-11-24
status: resolved
resolved: 2026-11-24
---

# Яндекс Webmaster — блокер recrawl

## Статус
Токен обновлён 2026-11-24 (user_id `666427228`, host `https:vsevmeste.space:443` verified). Recrawl POST API всё ещё **HTTP 504**; UI/очередь: money URLs `/salon` `/avtoservis` `/kafe` + blog — **DONE**. `quota_remainder≈1`.

## Что сделано
- В OAuth-приложение «Вместе» добавлен Redirect URI `https://oauth.yandex.ru/verification_code` (prod callback’и не трогали).
- `YANDEX_WEBMASTER_TOKEN` в `~/.cursor/skills/yandex-webmaster/config/.env` (не в git).
- API: user_id OK, host `https://vsevmeste.space/` verified, daily_quota=10.

## Дальше
- Повторить: `scripts/recrawl.sh --host vsevmeste.space --action submit --url …`
- Или вручную: Вебмастер → Индексирование → Переобход.
- При истечении токена (~1 год): authorize с `redirect_uri=verification_code`.
