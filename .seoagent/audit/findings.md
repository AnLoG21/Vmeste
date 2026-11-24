---
domain: vsevmeste.space
origin: https://vsevmeste.space
source_render: false
generated_at: 2026-11-24T14:29:11.451Z
findings: 1
source_evidence: .seoagent/audit/evidence.md
note: >-
  MACHINE-GENERATED findings report derived from the live-crawl evidence.
  The audit (audit/latest.md) BUILDS ON this file — it must carry every
  finding below forward (adding GSC context and prioritization on top),
  never re-derive or truncate the list. Do not hand-edit; re-run
  `seoagent crawl` to regenerate.
---

# Technical findings — vsevmeste.space (from the live crawl)

Derived by code from `.seoagent/audit/evidence.md` (crawled https://vsevmeste.space at 2026-11-24T14:29:11.451Z). Every finding below is **Confirmed** against that evidence. Reporting every one of these is non-negotiable — session economy trims bookkeeping, never findings.

## [Medium] 3 crawled pages are missing from sitemap.xml (36 URLs listed vs 39 pages discovered live)

**Confirmed** · Evidence: evidence.md § sitemap.xml — 36 URLs

**Check:** `sitemap_coverage_gap`

These pages are live and reachable (the crawl fetched them via nav links or discovery) but sitemap.xml does not list them.

Affected URLs:
- https://vsevmeste.space/blog/abonementy-i-loyalnost-v-salone
- https://vsevmeste.space/blog/analitika-dlya-vladelca-salona
- https://vsevmeste.space/blog/besplatnyj-tarif-vmeste-chto-vhodit

**Why it matters:** Pages absent from the sitemap depend entirely on link discovery, get crawled less often, and signal an unmaintained sitemap to search engines.

**Suggested fix:** Regenerate the sitemap to include every canonical public URL (prefer a framework-generated sitemap so it stays current), then resubmit it to Search Console.

## Already present on the live site — never recommend adding these

The crawl confirms the following already exist in the live server HTML. If the repo source lacks any of them, the **repo source is stale — the live page already serves it; reconcile the source** with what is live. Never phrase these as "add X".

- https://vsevmeste.space/ — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (Organization, WebSite, SoftwareApplication, BreadcrumbList, FAQPage)
- https://vsevmeste.space/businesses — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (WebPage, BreadcrumbList, SoftwareApplication, FAQPage)
- https://vsevmeste.space/salon — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (WebPage, BreadcrumbList, SoftwareApplication, FAQPage)
- https://vsevmeste.space/avtoservis — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (WebPage, BreadcrumbList, SoftwareApplication, FAQPage)
- https://vsevmeste.space/kafe — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (WebPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (Blog)
- https://vsevmeste.space/blog/kak-zapustit-biznes-na-vmeste-za-15-minut — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, HowTo)
- https://vsevmeste.space/blog/chem-vmeste-otlichaetsya-ot-yclients-i-dikidi — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/vidzhet-online-zapisi-na-sajt — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, HowTo)
- https://vsevmeste.space/blog/kak-nastroit-online-zapis-v-salone — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/programma-dlya-avtoservisa-chto-vybrat — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/qr-menyu-dlya-kafe-kak-zapustit — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/chem-vmeste-otlichaetsya-ot-aggregatorov — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/kak-privlech-klientov-cherez-kartu — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/kak-zapustit-vitrinu-magazina — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/kak-nastroit-zapis-neskolkih-masterov — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/kak-podelitsya-ssylkoj-zapisi-klientam — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (HowTo, Article, BreadcrumbList)
- https://vsevmeste.space/blog/kalendar-zapisey-v-kabinete — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList)
- https://vsevmeste.space/blog/katalog-uslug-i-ceny — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (HowTo, Article, BreadcrumbList)
- https://vsevmeste.space/blog/kak-dobavit-sotrudnika-i-prava — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (HowTo, Article, BreadcrumbList)
- https://vsevmeste.space/blog/chaty-i-soobshcheniya-o-zapisi — <title>, meta description, canonical, Open Graph tags, JSON-LD schema (Article, BreadcrumbList)
- https://vsevmeste.space/apps — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (WebPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/android — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (WebPage, BreadcrumbList, SoftwareApplication)
- https://vsevmeste.space/contacts — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (Organization, BreadcrumbList, ContactPage)
- https://vsevmeste.space/offer — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (BreadcrumbList, WebPage)
- https://vsevmeste.space/privacy — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (BreadcrumbList, WebPage)
- https://vsevmeste.space/city/moscow — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/spb — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/ekaterinburg — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/kazan — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/novosibirsk — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/nizhny — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/rostov — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/krasnodar — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/samara — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/city/chelyabinsk — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (CollectionPage, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/abonementy-i-loyalnost-v-salone — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (Article, BreadcrumbList, FAQPage)
- https://vsevmeste.space/blog/analitika-dlya-vladelca-salona — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (Article, BreadcrumbList)
- https://vsevmeste.space/blog/besplatnyj-tarif-vmeste-chto-vhodit — <title>, meta description, canonical, Open Graph tags, Twitter card, JSON-LD schema (Article, BreadcrumbList, FAQPage)
