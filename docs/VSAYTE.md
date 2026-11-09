# Всайте — конструктор, хостинг и домены

Сервис `vsayte` внутри Вместе: визуальный редактор сайтов, публикация и домены.

## Тарифы (`product_kind=vsayte`)

| Slug | Цена | Возможности |
|------|------|-------------|
| `vsayte-free` | 0 ₽ | Базовый редактор, локальные черновики (IndexedDB), без публикации |
| `vsayte-hosting` | 300 ₽/мес | Публикация на `{slug}.vsayte.vsevmeste.space` |
| `vsayte-pro` | 990 ₽/мес | Полный конструктор + свой домен (REG.RU) |

Тарифы **отдельны** от platform «Бизнес» и voice-пакетов.

## Публикация

- Статика пишется в `VSAYTE_SITES_ROOT` (по умолчанию `MEDIA_ROOT/vsayte-sites/{slug}/`).
- Caddy: `*.vsayte.{$DOMAIN}` → `file_server` из `/srv/media/vsayte-sites`.
- DNS: wildcard `*.vsayte` на IP сервера.

## Кастомные домены (Pro)

1. Пользователь проверяет/покупает домен через API REG.RU (`REGRU_USERNAME` / `REGRU_PASSWORD`).
2. Без ключей — mock-режим (заказ «принят», можно привязать домен вручную).
3. DNS A → `VSAYTE_HOST_IP`.
4. Caddy `on_demand_tls` спрашивает `GET /api/vsayte/tls-ask/?domain=…`.
5. Отдача: `GET /api/vsayte/serve/…` по `Host`.

## Env

```
VSAYTE_BASE_DOMAIN=vsayte.vsevmeste.space
VSAYTE_SITES_ROOT=
VSAYTE_HOST_IP=
REGRU_USERNAME=
REGRU_PASSWORD=
```

## UI

- `/vsayte` — приложение
- «Сервисы» → плитка Всайте
- Профиль → «Мои сайты»
- `/apps#vsayte` — маркетинговая страница
