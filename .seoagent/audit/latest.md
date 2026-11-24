---
domain: vsevmeste.space
audited_at: "2026-11-24T07:25:10.947Z"
crawl_origin: https://vsevmeste.space
pages_captured: 25
capture_complete: true
gsc_property: sc-domain:vsevmeste.space
---

# Technical SEO audit — vsevmeste.space

Grounded on `.seoagent/audit/evidence.md` (crawl 2026-11-24T07:25:10Z, `--max 25`) and `.seoagent/audit/indexing.md` / findings.md. Earlier incomplete crawl (timeouts during Deploy SSH) is superseded.

## 🚨 Biggest Issue

**Only 16/36 sitemap URLs indexed (44%) — money pages not in Google (Confirmed)** — `/salon`, `/avtoservis`, YCLIENTS comparison, widget guide, salon setup posts are «Discovered - currently not indexed»; `/businesses` and several posts are «Crawled - currently not indexed». Without `/salon` in the index, commercial queries cannot convert.

Evidence: indexing.md § Not indexed (20) — e.g. https://vsevmeste.space/salon, https://vsevmeste.space/avtoservis; § Indexed (16) includes `/`, `/kafe`, `/blog`.

👉 Deepen those URLs (thin body compounds soft-404 risk), add HTML internal links from indexed hubs (`/`, `/blog`, `/kafe`), request indexing in GSC after deploy, re-run `seoagent indexing`.

## ⚠️ Also Worth Fixing

1. **Thin commercial/blog bodies (Confirmed)** — homepage ~86 words, `/salon` ~278 pre-expand, many posts ~146–360 words (evidence.md body words). Expand toward competitor density.
2. **Origin timeouts during Deploy SSH (Confirmed in session)** — first crawl lost homepage/robots/sitemap; Caddy sitemap proxy now has short timeouts to fail fast.

## ✅ What's Working

- robots.txt HTTP 200 with absolute `Sitemap:` and sensible Disallow for cabinet/`/w/` (evidence.md § robots.txt).
- Captured pages: title, meta description, canonical, OG/Twitter, JSON-LD present — rollup shows no missing canonical/meta/H1/schema/alt gaps (evidence.md § Site-wide rollup).
- Homepage **Submitted and indexed** in GSC (`indexing.md`; last crawl 2026-11-22).
- SEOAgent login + GSC property `sc-domain:vsevmeste.space` connected (owner).

## Findings carried from findings.md

Re-crawl with healthy origin: **no confirmed mechanical findings** in regenerated findings.md (empty / none). Prior incomplete-crawl findings (robots/sitemap unreachable, 21 uncaptured URLs) were environment/timeout artifacts, not missing files in repo.

## Indexing coverage

- Homepage indexed (Confirmed · indexing.md).
- Full sitemap URL Inspection still running / pending deeper pass — do not claim blog/landings indexed until rows exist in indexing.md.

## Repo fixes started this session

- Drafted `.seoagent/context.md` (ONLINE-only SaaS, RU).
- Expanded `/salon` HTML + WhatsApp blog section + avtoservis “what to choose” block (deploy pending).
- Caddy sitemap proxy timeouts; nginx static `/sitemap.xml` fallback for non-Caddy paths.
