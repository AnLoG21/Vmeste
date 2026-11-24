---
domain: vsevmeste.space
origin: https://vsevmeste.space
origin_source: flag
source_render: false
captured_at: 2026-11-24T14:29:11.451Z
pages_crawled: 39
pages_discovered: 39
pages_captured: 39
capture_complete: true
note: >-
  Live-crawl evidence base. Every fact here was fetched from the live site.
  The audit must ground all Confirmed claims on THIS file, never on repo
  source or priors. Do NOT recommend adding schema / robots rules /
  canonical tags that already appear below.
---

# Live-Crawl Evidence — vsevmeste.space

**Crawled origin:** https://vsevmeste.space at 2026-11-24T14:29:11.451Z

## Repo routes not served live (1 — ignored, not a page of this site)

The repo scan inferred these routes from loose files (a top-level `*.html`, a route file), but the live site answers 404/410 for each, the sitemap does not list them and no crawled page links to them. They are NOT pages of this site: they are excluded from every count and finding in this file, and there is nothing to fix, redirect or remove for them. If one of them SHOULD be live, deploy it (or add it to the sitemap) and re-run `seoagent crawl`.

- https://vsevmeste.space/404 — HTTP 404 (repo-inferred, not live)

## robots.txt (Confirmed)
- Fetched: HTTP 200
- Disallow rules present: `/*.html$`, `/cabinet`, `/settings`, `/subscriptions`, `/organization`, `/cafe`, `/cafe-orders`, `/staff`, `/reviews`, `/bookings`, `/intervals`, `/chats`, `/analytics`, `/map`, `/book`, `/my-bookings`, `/my-reviews`, `/inspections`, `/i/`, `/t/`, `/w/`, `/vmenu`, `/vmagazine`, `/vkvartire`, `/shop`, `/service-apps`, `/marketplaces`, `/loyalty`, `/activity`, `/profile`, `/api/`, `/admin`, `/admin/`, `/media/`
- Sitemap declarations: https://vsevmeste.space/sitemap.xml
- Raw contents:
```
User-agent: *
Allow: /
Allow: /llms.txt
Allow: /contacts
Allow: /offer
Allow: /privacy
Allow: /businesses
Allow: /salon
Allow: /avtoservis
Allow: /kafe
Allow: /blog
Allow: /blog/
Allow: /apps
Allow: /android
Allow: /o/
Allow: /m/
Allow: /s/
Allow: /city/
Allow: /legal/

# Дубли HTML-файлов (канонические URL без .html)
Disallow: /*.html$

# Личный кабинет и приложение — не индексировать
Disallow: /cabinet
Disallow: /settings
Disallow: /subscriptions
Disallow: /organization
Disallow: /cafe
Disallow: /cafe-orders
Disallow: /staff
Disallow: /reviews
Disallow: /bookings
Disallow: /intervals
Disallow: /chats
Disallow: /analytics
Disallow: /map
Disallow: /book
Disallow: /my-bookings
Disallow: /my-reviews
Disallow: /inspections
Disallow: /i/
Disallow: /t/
Disallow: /w/
Disallow: /vmenu
Disallow: /vmagazine
Disallow: /vkvartire
Disallow: /shop
Disallow: /service-apps
Disallow: /marketplaces
Disallow: /loyalty
Disallow: /activity
Disallow: /profile
Disallow: /api/
Disallow: /admin
Disallow: /admin/
Disallow: /media/

# Разрешаем файл подтверждения Яндекс.Вебмастера
Allow: /yandex_84ec889f078f5b2d.html

Sitemap: https://vsevmeste.space/sitemap.xml
```

## sitemap.xml (Confirmed)
- **36 URLs**, 15 blog/article posts

## Site-wide rollup (Confirmed)
- **Pages missing canonical:** _(none — all pages pass)_
- **Pages missing meta description:** _(none — all pages pass)_
- **Pages with multiple H1s:** _(none — all pages pass)_
- **Pages with no structured data (zero JSON-LD):** _(none — all pages pass)_
- **Images missing alt:** _(none — every crawled image has an alt attribute)_

## https://vsevmeste.space/
- HTTP 200 · 86 body words
- **title:** Вместе (vsevmeste) — онлайн-запись клиентов и автоматизация бизнеса
- **meta description:** Вместе (vsevmeste.space) — онлайн-запись, каталог услуг и чаты. Запись бесплатно без срока, Бизнес — 990 ₽/мес. Салоны, автосервисы, кафе.
- **h1(s):** `Вместе — платформа для записи и автоматизации бизнеса`
- **canonical:** `https://vsevmeste.space/` (server-rendered)
- **JSON-LD @types present:** `Organization`, `WebSite`, `SoftwareApplication`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:site_name, og:url, og:title, og:description, og:locale, og:image, og:image:alt, og:image:width, og:image:height
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/businesses
- HTTP 200 · 424 body words
- **title:** Для бизнеса — онлайн-запись, QR-меню и кабинет | Вместе
- **meta description:** Вместе для салонов, автосервисов и кафе: онлайн-запись без комиссии с визита, QR-меню, чаты, сотрудники. Бесплатный тариф без срока, Бизнес — 990 ₽/мес. Запуск за вечер.
- **h1(s):** `Кабинет для бизнеса: запись, меню, чаты — без комиссии с визита`
- **canonical:** `https://vsevmeste.space/businesses` (server-rendered)
- **JSON-LD @types present:** `WebPage`, `BreadcrumbList`, `SoftwareApplication`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/salon
- HTTP 200 · 542 body words
- **title:** Онлайн-запись для салона красоты — Вместе
- **meta description:** Онлайн-запись для салона красоты: каталог, мастера, чат, карта. Без комиссии с записи. Бесплатно без срока, Бизнес — 990 ₽/мес. Альтернатива YCLIENTS и WhatsApp.
- **h1(s):** `Онлайн-запись для салона красоты`
- **canonical:** `https://vsevmeste.space/salon` (server-rendered)
- **JSON-LD @types present:** `WebPage`, `BreadcrumbList`, `SoftwareApplication`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/avtoservis
- HTTP 200 · 607 body words
- **title:** Программа для автосервиса: запись и приёмка — Вместе
- **meta description:** Онлайн-запись в автосервис, VIN и госномер, интерактивная приёмка, статусы ремонта и чат с клиентом. Бесплатный тариф без срока, Бизнес — 990 ₽/мес.
- **h1(s):** `Программа для автосервиса: запись и приёмка`
- **canonical:** `https://vsevmeste.space/avtoservis` (server-rendered)
- **JSON-LD @types present:** `WebPage`, `BreadcrumbList`, `SoftwareApplication`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/kafe
- HTTP 200 · 375 body words
- **title:** QR-меню и заказы для кафе и ресторанов — Вместе
- **meta description:** План зала, QR и PIN на столы, меню с фото и ккал, заказ за столом / навынос / доставка и оплата онлайн. Бесплатный старт, Бизнес — 990 ₽/мес.
- **h1(s):** `QR-меню и заказы для кафе и ресторанов`
- **canonical:** `https://vsevmeste.space/kafe` (server-rendered)
- **JSON-LD @types present:** `WebPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog
- HTTP 200 · 344 body words
- **title:** Блог Вместе — для владельцев салонов, СТО и кафе
- **meta description:** Гайды для бизнеса: запись вместо WhatsApp, предоплата и неприходы, напоминания, абонементы, YCLIENTS и Dikidi, виджет, QR-меню. Без воды — к регистрации.
- **h1(s):** `Блог для бизнеса`
- **canonical:** `https://vsevmeste.space/blog` (server-rendered)
- **JSON-LD @types present:** `Blog` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card
- **images:** 59 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/kak-zapustit-biznes-na-vmeste-za-15-minut
- HTTP 200 · 360 body words
- **title:** Как запустить бизнес на Вместе за 15 минут — чек-лист
- **meta description:** Пошаговый чек-лист: регистрация организации, каталог услуг или меню, ссылка клиентам. Онлайн-запись бесплатно без срока. Для салона, автосервиса и кафе.
- **h1(s):** `Как запустить бизнес на Вместе за 15 минут`
- **canonical:** `https://vsevmeste.space/blog/kak-zapustit-biznes-na-vmeste-za-15-minut` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `HowTo` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/chem-vmeste-otlichaetsya-ot-yclients-i-dikidi
- HTTP 200 · 615 body words
- **title:** Вместе vs YCLIENTS и Dikidi: сравнение для салона и сервиса
- **meta description:** Чем Вместе отличается от YCLIENTS и Dikidi: свой кабинет без комиссии с записи, сценарии для салона, автосервиса и QR-меню кафе, бесплатный тариф без срока. Честное сравнение для выбора.
- **h1(s):** `Вместе vs YCLIENTS и Dikidi: что выбрать салону и сервису`
- **canonical:** `https://vsevmeste.space/blog/chem-vmeste-otlichaetsya-ot-yclients-i-dikidi` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/vidzhet-online-zapisi-na-sajt
- HTTP 200 · 479 body words
- **title:** Виджет онлайн-записи на сайт салона или сервиса — Вместе
- **meta description:** Как встроить виджет онлайн-записи Вместе на свой сайт: ссылка /w/…, для кого подходит, чем отличается от переписки в мессенджере. Без разработчика за вечер.
- **h1(s):** `Виджет онлайн-записи на сайт: как подключить без разработчика`
- **canonical:** `https://vsevmeste.space/blog/vidzhet-online-zapisi-na-sajt` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `HowTo` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/kak-nastroit-online-zapis-v-salone
- HTTP 200 · 542 body words
- **title:** Как настроить онлайн-запись в салоне красоты — Вместе
- **meta description:** Пошагово: каталог услуг, график мастеров, ссылка для клиентов и карта. Онлайн-запись в салоне без мессенджер-хаоса — на платформе Вместе.
- **h1(s):** `Как настроить онлайн-запись в салоне красоты за один вечер`
- **canonical:** `https://vsevmeste.space/blog/kak-nastroit-online-zapis-v-salone` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card
- **images:** 2 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/programma-dlya-avtoservisa-chto-vybrat
- HTTP 200 · 396 body words
- **title:** Программа для автосервиса: на что смотреть при выборе — Вместе
- **meta description:** Чек-лист выбора программы для СТО: запись, VIN, приёмка, статусы ремонта, чат с клиентом. Как Вместе закрывает цепочку от слота до «готово».
- **h1(s):** `Программа для автосервиса: на что смотреть при выборе`
- **canonical:** `https://vsevmeste.space/blog/programma-dlya-avtoservisa-chto-vybrat` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/qr-menyu-dlya-kafe-kak-zapustit
- HTTP 200 · 392 body words
- **title:** QR-меню для кафе: как запустить без приложения для гостя — Вместе
- **meta description:** Как сделать QR-меню в кафе: план зала, PIN стола, карточки блюд, заказ за столом / навынос / доставка. Без установки приложения гостем — на Вместе.
- **h1(s):** `QR-меню для кафе: как запустить без приложения для гостя`
- **canonical:** `https://vsevmeste.space/blog/qr-menyu-dlya-kafe-kak-zapustit` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 3 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/chem-vmeste-otlichaetsya-ot-aggregatorov
- HTTP 200 · 329 body words
- **title:** Чем Вместе отличается от агрегаторов записи — блог Вместе
- **meta description:** Агрегатор продаёт витрину чужих объявлений. Вместе — ваш кабинет: запись, чаты, меню, сотрудники и публичная страница. Сравнение без воды.
- **h1(s):** `Чем Вместе отличается от агрегаторов записи`
- **canonical:** `https://vsevmeste.space/blog/chem-vmeste-otlichaetsya-ot-aggregatorov` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/kak-privlech-klientov-cherez-kartu
- HTTP 200 · 234 body words
- **title:** Как привлечь клиентов через карту организаций — Вместе
- **meta description:** Как попасть на карту Вместе и получать клиентов рядом: адрес, сфера, фото, запись с карточки. Советы для салонов, СТО и кафе в Москве и СПб.
- **h1(s):** `Как привлечь клиентов через карту организаций`
- **canonical:** `https://vsevmeste.space/blog/kak-privlech-klientov-cherez-kartu` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/kak-zapustit-vitrinu-magazina
- HTTP 200 · 196 body words
- **title:** Как запустить интернет-витрину магазина онлайн — Вместе
- **meta description:** Как открыть публичную витрину магазина на Вместе: каталог, самовывоз и доставка, ссылка /s/… без отдельного сайта. Для салонов, СТО и магазинов.
- **h1(s):** `Как запустить интернет-витрину магазина онлайн`
- **canonical:** `https://vsevmeste.space/blog/kak-zapustit-vitrinu-magazina` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/kak-nastroit-zapis-neskolkih-masterov
- HTTP 200 · 337 body words
- **title:** Как настроить запись к нескольким мастерам — Вместе
- **meta description:** Онлайн-запись для салона с несколькими мастерами: роли сотрудников, график, услуги и публичная ссылка. Без отдельного администратора на телефоне.
- **h1(s):** `Как настроить запись к нескольким мастерам`
- **canonical:** `https://vsevmeste.space/blog/kak-nastroit-zapis-neskolkih-masterov` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/kak-podelitsya-ssylkoj-zapisi-klientam
- HTTP 200 · 230 body words
- **title:** Как поделиться ссылкой записи с клиентами — Вместе
- **meta description:** Где взять ссылку /w/… и iframe виджета в кабинете Вместе: скрины настроек организации и публичной записи. Отправьте клиентам или вставьте на сайт.
- **h1(s):** `Как поделиться ссылкой записи с клиентами`
- **canonical:** `https://vsevmeste.space/blog/kak-podelitsya-ssylkoj-zapisi-klientam` (server-rendered)
- **JSON-LD @types present:** `HowTo`, `Article`, `BreadcrumbList` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 3 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/kalendar-zapisey-v-kabinete
- HTTP 200 · 199 body words
- **title:** Календарь записей в кабинете Вместе — где смотреть и бронировать
- **meta description:** Гайд со скринами: вкладка «Записи», календарь интервалов, ручная бронь клиента. Как вести день салона или сервиса во Вместе.
- **h1(s):** `Календарь записей в кабинете: что где лежит`
- **canonical:** `https://vsevmeste.space/blog/kalendar-zapisey-v-kabinete` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 3 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/katalog-uslug-i-ceny
- HTTP 200 · 346 body words
- **title:** Каталог услуг и цены во Вместе — как настроить
- **meta description:** Скрины: Меню → Услуги и категории. Загрузка шаблона сферы, цены, длительность, лояльность и абонементы. Для салона и сервиса.
- **h1(s):** `Каталог услуг и цены: как настроить за вечер`
- **canonical:** `https://vsevmeste.space/blog/katalog-uslug-i-ceny` (server-rendered)
- **JSON-LD @types present:** `HowTo`, `Article`, `BreadcrumbList` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 2 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/kak-dobavit-sotrudnika-i-prava
- HTTP 200 · 160 body words
- **title:** Как добавить сотрудника и настроить права — Вместе
- **meta description:** Скрины кабинета: приглашение мастера или администратора, роли и права. Тариф «Бизнес» 990 ₽/мес. Пошагово для салона и сервиса.
- **h1(s):** `Как добавить сотрудника и настроить права`
- **canonical:** `https://vsevmeste.space/blog/kak-dobavit-sotrudnika-i-prava` (server-rendered)
- **JSON-LD @types present:** `HowTo`, `Article`, `BreadcrumbList` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 2 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/chaty-i-soobshcheniya-o-zapisi
- HTTP 200 · 217 body words
- **title:** Чаты и сообщения о записи во Вместе — гайд со скринами
- **meta description:** Где чаты с клиентами и шаблоны подтверждения/отмены записи. Скрины кабинета Вместе: Чаты и Организация → сообщения.
- **h1(s):** `Чаты и сообщения о записи: что где настроить`
- **canonical:** `https://vsevmeste.space/blog/chaty-i-soobshcheniya-o-zapisi` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** _(none)_
- **images:** 3 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/apps
- HTTP 200 · 176 body words
- **title:** Сервисы платформы — Вменю, Вмагазине, Вквартире | Вместе
- **meta description:** Микросервисы Вместе: Вменю (рецепты), Вмагазине (витрины), Вквартире (жильё) и голосовой ассистент. Один аккаунт, без отдельных регистраций.
- **h1(s):** `Сервисы платформы Вместе`
- **canonical:** `https://vsevmeste.space/apps` (server-rendered)
- **JSON-LD @types present:** `WebPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/android
- HTTP 200 · 112 body words
- **title:** Скачать Android-приложение Вместе — RuStore и APK
- **meta description:** Приложение Вместе в RuStore: системные push и виджет записей. Ярлык «На экран Домой» из Chrome — это сайт, не приложение. Есть запасной APK.
- **h1(s):** `Приложение для Android`
- **canonical:** `https://vsevmeste.space/android` (server-rendered)
- **JSON-LD @types present:** `WebPage`, `BreadcrumbList`, `SoftwareApplication` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/contacts
- HTTP 200 · 122 body words
- **title:** Контакты и реквизиты — Вместе
- **meta description:** Контакты и реквизиты сервиса Вместе: самозанятый Логинов А.А., ИНН 971500759750, Москва.
- **h1(s):** `Контакты и реквизиты`
- **canonical:** `https://vsevmeste.space/contacts` (server-rendered)
- **JSON-LD @types present:** `Organization`, `BreadcrumbList`, `ContactPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/offer
- HTTP 200 · 262 body words
- **title:** Публичная оферта — Вместе
- **meta description:** Публичная оферта сервиса Вместе: условия подписки, тарифы, порядок оказания услуг.
- **h1(s):** `Публичная оферта`
- **canonical:** `https://vsevmeste.space/offer` (server-rendered)
- **JSON-LD @types present:** `BreadcrumbList`, `WebPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/privacy
- HTTP 200 · 206 body words
- **title:** Политика конфиденциальности — Вместе
- **meta description:** Политика конфиденциальности сервиса Вместе: обработка персональных данных пользователей.
- **h1(s):** `Политика конфиденциальности`
- **canonical:** `https://vsevmeste.space/privacy` (server-rendered)
- **JSON-LD @types present:** `BreadcrumbList`, `WebPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/moscow
- HTTP 200 · 189 body words
- **title:** Вместе в Москве — онлайн-запись, кафе и сервисы | vsevmeste
- **meta description:** Платформа Вместе (vsevmeste.space) в Москве: онлайн-запись в салоны и автосервисы, меню кафе по QR, карта организаций рядом с вами.
- **h1(s):** `Вместе · Москва`
- **canonical:** `https://vsevmeste.space/city/moscow` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/spb
- HTTP 200 · 198 body words
- **title:** Вместе в Санкт-Петербурге — онлайн-запись и кафе | vsevmeste
- **meta description:** Вместе (vsevmeste.space) в Санкт-Петербурге: запись в салоны и автосервисы, меню ресторанов, карта локального бизнеса и чаты с клиентами.
- **h1(s):** `Вместе · Санкт-Петербург`
- **canonical:** `https://vsevmeste.space/city/spb` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/ekaterinburg
- HTTP 200 · 180 body words
- **title:** Вместе в Екатеринбурге — онлайн-запись и QR-меню | vsevmeste
- **meta description:** Вместе в Екатеринбурге: запись в салоны и автосервисы, меню кафе по QR, карта организаций и чаты с клиентами.
- **h1(s):** `Вместе · Екатеринбург`
- **canonical:** `https://vsevmeste.space/city/ekaterinburg` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/kazan
- HTTP 200 · 188 body words
- **title:** Вместе в Казани — запись в салоны и автосервисы | vsevmeste
- **meta description:** Платформа Вместе в Казани: онлайн-запись, карта организаций, QR-меню для кафе и чаты с клиентами без комиссии с записи.
- **h1(s):** `Вместе · Казань`
- **canonical:** `https://vsevmeste.space/city/kazan` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/novosibirsk
- HTTP 200 · 192 body words
- **title:** Вместе в Новосибирске — онлайн-запись и карта бизнеса | vsevmeste
- **meta description:** Вместе в Новосибирске: салоны, автосервисы и кафе на одной платформе — запись, QR-меню, чаты и карта организаций.
- **h1(s):** `Вместе · Новосибирск`
- **canonical:** `https://vsevmeste.space/city/novosibirsk` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/nizhny
- HTTP 200 · 189 body words
- **title:** Вместе в Нижнем Новгороде — запись и QR-меню | vsevmeste
- **meta description:** Вместе в Нижнем Новгороде: онлайн-запись для салонов и автосервисов, QR-меню кафе, карта и чаты с клиентами.
- **h1(s):** `Вместе · Нижний Новгород`
- **canonical:** `https://vsevmeste.space/city/nizhny` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/rostov
- HTTP 200 · 188 body words
- **title:** Вместе в Ростове-на-Дону — онлайн-запись и кафе | vsevmeste
- **meta description:** Вместе в Ростове-на-Дону: запись в салоны и автосервисы, QR-меню кафе, карта организаций и чаты с клиентами.
- **h1(s):** `Вместе · Ростов-на-Дону`
- **canonical:** `https://vsevmeste.space/city/rostov` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/krasnodar
- HTTP 200 · 171 body words
- **title:** Вместе в Краснодаре — запись, QR-меню и карта | vsevmeste
- **meta description:** Вместе в Краснодаре: онлайн-запись для салонов и автосервисов, меню кафе по QR, карта и чаты с клиентами.
- **h1(s):** `Вместе · Краснодар`
- **canonical:** `https://vsevmeste.space/city/krasnodar` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/samara
- HTTP 200 · 180 body words
- **title:** Вместе в Самаре — онлайн-запись и сервисы | vsevmeste
- **meta description:** Вместе в Самаре: запись в салоны и автосервисы, QR-меню кафе, карта локального бизнеса и уведомления клиентам.
- **h1(s):** `Вместе · Самара`
- **canonical:** `https://vsevmeste.space/city/samara` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/city/chelyabinsk
- HTTP 200 · 176 body words
- **title:** Вместе в Челябинске — онлайн-запись и QR-меню | vsevmeste
- **meta description:** Вместе в Челябинске: онлайн-запись для салонов и автосервисов, меню кафе по QR, карта организаций и чаты.
- **h1(s):** `Вместе · Челябинск`
- **canonical:** `https://vsevmeste.space/city/chelyabinsk` (server-rendered)
- **JSON-LD @types present:** `CollectionPage`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:locale, og:site_name, og:title, og:description, og:url, og:image, og:image:alt
- **Twitter:** twitter:card, twitter:title, twitter:description, twitter:image
- **images:** 0 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/abonementy-i-loyalnost-v-salone
- HTTP 200 · 270 body words
- **title:** Абонементы и лояльность в салоне — пакеты визитов во Вместе
- **meta description:** Как завести абонементы и баллы лояльности в кабинете Вместе: пакеты визитов, списание при записи, напоминание о конце срока. Для салонов красоты и сервисов.
- **h1(s):** `Абонементы и лояльность в салоне`
- **canonical:** `https://vsevmeste.space/blog/abonementy-i-loyalnost-v-salone` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card
- **images:** 2 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/analitika-dlya-vladelca-salona
- HTTP 200 · 208 body words
- **title:** Аналитика для владельца салона: выручка, услуги, нагрузка — Вместе
- **meta description:** Что смотреть владельцу салона в аналитике Вместе: динамика записей, популярные услуги, нагрузка мастеров. Решения на цифрах, а не на ощущении «вчера было тихо».
- **h1(s):** `Аналитика для владельца салона`
- **canonical:** `https://vsevmeste.space/blog/analitika-dlya-vladelca-salona` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.

## https://vsevmeste.space/blog/besplatnyj-tarif-vmeste-chto-vhodit
- HTTP 200 · 177 body words
- **title:** Бесплатный тариф Вместе: что входит и когда нужен «Бизнес»
- **meta description:** Что даёт бесплатный тариф Вместе без срока: онлайн-запись, каталог, чаты, карта. Чем отличается «Бизнес» за 990 ₽/мес — сотрудники и приоритетная поддержка.
- **h1(s):** `Бесплатный тариф Вместе: что входит`
- **canonical:** `https://vsevmeste.space/blog/besplatnyj-tarif-vmeste-chto-vhodit` (server-rendered)
- **JSON-LD @types present:** `Article`, `BreadcrumbList`, `FAQPage` — **already present; do NOT recommend adding these**
- **Open Graph:** og:type, og:url, og:title, og:description, og:locale, og:image
- **Twitter:** twitter:card
- **images:** 1 total, all have alt
- **Already present (do NOT recommend adding):** <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema — verified in the server `<head>`.
