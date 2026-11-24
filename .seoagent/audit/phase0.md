# Фаза 0 — статус (2026-11-24)

Цель: sitemap стабильно 200; GSC/Яндекс приняли sitemap; Inspection по приоритету; аптайм без «дыры» на деплое. Метрика фазы: `/salon` и `/avtoservis` = Indexed.

## Сделано

| Шаг | Статус | Деталь |
|---|---|---|
| Live sitemap/robots/money pages | OK | `/sitemap.xml` 200 (gunicorn, 36 URL); money pages 200 |
| GSC property | OK | `sc-domain:vsevmeste.space` |
| GSC sitemap submit | OK | повторно `https://vsevmeste.space/sitemap.xml` |
| GSC URL Inspection batch | OK | `seoagent indexing --max 40` → **16/36 indexed (44%)** |
| Request indexing `/salon` | OK | Live: «можно проиндексировать» → **запрос отправлен** |
| Request indexing `/avtoservis` | OK | **запрос отправлен** (было Discovered — not indexed) |
| Caddy sitemap 5xx → frontend | Deployed | `5145097` |
| Deploy edge resilience | Deployed | `4043cf2` — reload Caddy, 2G swap, oom_score, stop agents; успешный деплой с salon=200 ~8 мин подряд |
| Яндекс sitemap | Partial | сайт в Вебмастере; sitemap из robots.txt status **ок** (08.10, 9 URL — устаревший снимок); инструмент «Файлы Sitemap» сейчас **read-only** у Яндекса |
| Яндекс API token | Missing | нет `YANDEX_WEBMASTER_TOKEN` для recrawl CLI |

## GSC coverage (Inspection snapshot)

| URL | State |
|---|---|
| `/` `/kafe` `/blog` | Indexed |
| `/salon` | Request indexing отправлен (ранее Discovered / unknown) |
| `/avtoservis` | Request indexing отправлен (Discovered — not indexed) |
| `/businesses` | Crawled — not indexed |

GSC Pages report: **43 indexed / 26 not** (update 16.11): 17 Discovered, 3 Crawled, 4 redirect, 1 canonical, 1×404.

## Commits

- `5145097` — Caddy sitemap fallback + no edge recreate (v1) + phase0 audit
- `4043cf2` — OOM/edge protect: reload-only Caddy, swap 2G, oom_score_adj, stop agents

## Осталось до закрытия метрики фазы

1. Дождаться Indexed у `/salon` и `/avtoservis` (обычно дни; еженедельно `seoagent indexing --match "/salon\|/avtoservis"`).
2. Когда Яндекс снимет read-only — переотправить sitemap + recrawl money URLs (или положить `YANDEX_WEBMASTER_TOKEN`).
3. Request indexing для `/businesses` + топ коммерческих постов при стабильном аптайме.
4. Не копить деплои на 1G VPS — каждый долгий build рискует host-level timeout.
