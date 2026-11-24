---
title: SEO audit — vsevmeste.space
date: 2026-11-24
origin: https://vsevmeste.space
evidence: audit/evidence.md
indexing: GSC URL Inspection (priority matches 2026-11-24)
---

# SEO audit — vsevmeste.space (2026-11-24)

## Technical findings (from live crawl — carry all)

1. **[Medium] sitemap_coverage_gap** — Confirmed · Evidence: findings.md / evidence.md § sitemap.xml  
   Live pages not in sitemap (36 listed vs 39 discovered in crawl sample):  
   - `/blog/abonementy-i-loyalnost-v-salone`  
   - `/blog/analitika-dlya-vladelca-salona`  
   - `/blog/besplatnyj-tarif-vmeste-chto-vhodit`  
   Crawl capped at 40 of 82 discovered → coverage gap may be larger (lower bound).

2. **[High] Homepage thin server HTML** — Confirmed · Evidence: evidence.md § `/` — **86 body words**  
   Money pages have meta/canonical/OG/JSON-LD OK; homepage remains shell-thin for crawlers (plan § фаза 1 п.2).

## Indexing (GSC — Confirmed)

| URL | Coverage | Last crawl | Notes |
|---|---|---|---|
| `/kafe` | Submitted and indexed | 2026-11-19 | Only money pillar Indexed |
| `/salon` | Crawled — currently not indexed | 2026-11-24T09:28 | canBeIndexed false |
| `/avtoservis` | Crawled — currently not indexed | 2026-11-24T09:30 | canBeIndexed false |
| `/businesses` | Crawled — currently not indexed | 2026-10-30 | Stale crawl vs others |
| compare YCLIENTS post | Crawled — currently not indexed | 2026-11-24T11:04 | Same NEUTRAL pattern |

Phase 0 metric (`/salon`+`/avtoservis` Indexed) **not met**.

## Live content volume (crawl body words)

| URL | Words | Target (plan) |
|---|---|---|
| `/` | 86 | server-visible anchors + text |
| `/salon` | 542 | 1200+ |
| `/avtoservis` | 607 | 1200+ |
| `/kafe` | 375 | 1200+ |
| `/businesses` | 424 | — |
| compare YCLIENTS post | 615 | — |

Local deepen/FAQ/client-path still **not fully reflected as 1200+** on live (and city `localNote` / updated `llms.txt` city titles **not live** — WebFetch 2026-11-24).

## Already present live (do NOT recommend adding)

Per findings.md: title, meta, canonical, OG/Twitter, JSON-LD on money pages, blog hubs, cities, legal — all Confirmed present.

## Outreach / authority (фаза 3)

Live: VC×3, Zapustilis, IT-Podium.  
Submitted (moderation): Product Radar, AppRater, Ignlab, SEODataPulse, Viesearch, SaaSLineup, SaaS Radius, FreeSaaSList.  
Blocked on owner: PeerPush/yourhack OTP, SoftFinder captcha, sign-in catalogs, Twelve.tools/TheSaaSDir (need deploy badge).

Referring domains ≪ 15 (phase metric).

## Global plan gap (what remains)

| Phase | Status | Still open |
|---|---|---|
| 0 Foundation | Partial | Money Indexed metric; weekly indexing; request indexing after deploy |
| 1 Convert pages | Partial | Homepage SSR text; deepen pillars to 1200+ **deployed**; sitemap completeness |
| 2 Yandex + Wordstat | Partial | Wordstat key → keywords.md; Metrika registration + organic UTM; Yandex «не индексируется» dig |
| 3 Authority | In progress | Owner OTP/captcha; deploy→Twelve.tools; Habr/отраслевой guest; Maps/2GIS client /w/…; brand queries |
| 4 Programmatic | Started local | Deploy city `localNote`; seed real `/o/…` orgs with photos/services; **no** marketplace cluster yet |
| 5 AEO | Started local | Deploy OKF/llms updates; monthly AEO prompt checklist run |

## Priority next (ordered)

1. **Deploy** undeployed SEO batch (money deepen, twelve.tools footer, city localNote, OKF/llms).  
2. GSC Request indexing `/salon` `/avtoservis` `/businesses` after deploy + IndexNow.  
3. Fix sitemap to include all public blog URLs.  
4. Owner: OTP PeerPush + yourhack; SoftFinder captcha.  
5. Homepage: more server-visible copy + anchors to money URLs.  
6. Wordstat when API key → align titles/H1.  
7. One Habr/отраслевой guest OR Maps growth loop.  
8. Run AEO checklist once; log AI answer errors.
