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

API покупки/привязки и `tls-ask` / `serve` уже есть. Публичный catch-all `https://` + `on_demand_tls` в Caddy **отключён** (ронял весь Caddy) — включаем отдельно после проверки конфига.

Сейчас в проде: поддомены `*.vsayte.{$DOMAIN}` → `rewrite` на `/api/vsayte/serve`.

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
