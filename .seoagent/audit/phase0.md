# Фаза 0 — статус (2026-11-24)

Цель: sitemap стабильно 200; GSC/Яндекс приняли sitemap; Inspection по приоритету; аптайм без «дыры» на деплое. Метрика фазы: `/salon` и `/avtoservis` = Indexed.

## Сделано

| Шаг | Статус | Деталь |
|---|---|---|
| Live sitemap/robots/money pages | OK (когда origin up) | `/sitemap.xml` 200 gunicorn, 36 URL; `/salon` `/avtoservis` `/kafe` 200 nginx static |
| GSC property | OK | `sc-domain:vsevmeste.space`, owner `analog803@gmail.com` |
| GSC sitemap submit | OK | повторно отправлен `https://vsevmeste.space/sitemap.xml` 2026-11-24 |
| GSC URL Inspection batch | OK | `seoagent indexing --max 40` → **16/36 indexed (44%)** → `.seoagent/audit/indexing.md` |
| Static sitemap fallback sync | OK | `frontend/public/sitemap.xml` синхронизирован с live (36 URL) |
| Caddy sitemap 5xx → frontend | Code ready | `Caddyfile` + `Caddyfile.http-only`: `handle_response` @500–504 → `frontend:80` |
| Deploy без force-recreate caddy | Code ready | `scripts/deploy-prod.sh`: не роняет edge на каждый push; cloudflared не churn |
| Request indexing `/salon` `/avtoservis` | BLOCKED (GSC) | После аптайма 200 Live/Request всё ещё: site-wide unavailable (хост-статус после ~20 мин downtime деплоя 45352190238). Повторить через несколько часов. |
| GSC not-indexed reasons (отчёт 16.11) | OK read | 17 Discovered; 3 Crawled; 4 redirect; 1 canonical; 1×404. Indexed всего 43. |
| Яндекс.Вебмастер API | BLOCKED | нет `YANDEX_WEBMASTER_TOKEN` в `~/.agents/skills/yandex-webmaster/config/.env` |

## GSC coverage (money)

| URL | State |
|---|---|
| `/` | Indexed |
| `/kafe` | Indexed |
| `/blog` | Indexed |
| `/salon` | Discovered — not indexed |
| `/avtoservis` | Discovered — not indexed |
| `/businesses` | Crawled — not indexed |

## Корневая причина отказа Request indexing

Во время деплоя `45352190238` origin отдавал `000` (таймаут 15–20с) снаружи. Google Live Inspection зафиксировал **site-wide availability**. Пока деплой force-recreate'ил caddy (+ tunnel churn) — запрос индексирования отклонялся.

## Что задеплоить (локальные правки)

1. `Caddyfile` / `Caddyfile.http-only` — fallback sitemap
2. `scripts/deploy-prod.sh` — не force-recreate caddy/cloudflared без нужды
3. `frontend/public/sitemap.xml` — актуальный fallback

## Яндекс — путь (когда будет токен)

```bash
cp ~/.agents/skills/yandex-webmaster/config/.env.example ~/.agents/skills/yandex-webmaster/config/.env
# YANDEX_WEBMASTER_TOKEN=...
bash ~/.agents/skills/yandex-webmaster/scripts/hosts.sh --search vsevmeste
bash ~/.agents/skills/yandex-webmaster/scripts/sitemaps.sh --host vsevmeste.space --action add --url https://vsevmeste.space/sitemap.xml
bash ~/.agents/skills/yandex-webmaster/scripts/recrawl.sh --host vsevmeste.space --url https://vsevmeste.space/salon
bash ~/.agents/skills/yandex-webmaster/scripts/recrawl.sh --host vsevmeste.space --url https://vsevmeste.space/avtoservis
```

Верификация файла уже на сайте: `/yandex_84ec889f078f5b2d.html`.

## Следующий проход фазы 0 (после аптайма)

1. Дождаться зелёного деплоя / origin 200 стабильно 5+ минут.
2. Закоммитить/задеплоить Caddy+deploy hardenings.
3. GSC: Request indexing для `/salon` `/avtoservis` `/businesses` + топ коммерческих постов.
4. Выдать `YANDEX_WEBMASTER_TOKEN` → sitemap + recrawl.
5. Еженедельно `seoagent indexing --max 40` пока money-page Indexed ≥ 70% (`/salon`+`/avtoservis` обязательны).
