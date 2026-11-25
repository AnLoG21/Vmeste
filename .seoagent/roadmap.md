# Content / SEO roadmap — vsevmeste.space

**Глобальный план:** `.seoagent/strategy/global-plan.md`

Cluster order: salon-booking (ICP) → autoservice → cafe-qr → compare-crm

## Cluster: salon-booking

- [x] PILLAR  salon — "онлайн запись для салона красоты"
- [x] SUB     kak-nastroit-online-zapis-v-salone
- [x] SUB     zapis-vmesto-whatsapp
- [x] SUB     zapis-dlya-solo-mastera
- [x] LONG_TAIL napominaniya-o-zapisi-klientam
- [x] LONG_TAIL kak-snizit-neprihody-predoplata
- [x] LONG_TAIL kak-nastroit-zapis-neskolkih-masterov

## Cluster: autoservice

- [x] PILLAR  avtoservis
- [x] SUB     online-zapis-v-avtoservise
- [x] SUB     programma-dlya-avtoservisa-chto-vybrat
- [x] LONG_TAIL priemka-v-avtoservise-foto-defektov

## Cluster: cafe-qr

- [x] PILLAR  kafe
- [x] SUB     qr-menyu-dlya-kafe-kak-zapustit
- [x] LONG_TAIL ekran-kuhni-dlya-kafe

## Cluster: compare-crm

- [x] PILLAR  chem-vmeste-otlichaetsya-ot-yclients-i-dikidi
- [x] SUB     chem-vmeste-otlichaetsya-ot-aggregatorov

## Long-tails from cloud briefs

- [x] sinhronizaciya-s-google-i-yandex-kalendarem
- [x] telegram-napominaniya-organizacii

## Next increment (фаза 0–1 global plan)

- [x] GSC sitemap resubmit + Inspection 36 URL (см. audit/phase0.md)
- [x] Deploy hardenings (Caddy fallback + edge OOM protect) `5145097` `4043cf2`
- [x] GSC Request indexing `/salon` `/avtoservis` (ожидаем Indexed)
- [x] Яндекс: токен OK; ручной переобход money URLs **DONE** 2026-11-24 (`/`, `/salon`, `/avtoservis`, `/kafe`, compare)
- [x] РСЯ: слот только в блоге (`rsya-blog.js` + `rsya-config.json`, enabled:false) — `audit/yandex-rsya.md`; money pages запрещены
- [x] IndexNow key file `frontend/public/485582172a16a2d5afa94ef65a74603e.txt` (inbox 7199; shipped `309d0e3`)
- [ ] Weekly `seoagent indexing` until `/salon`+`/avtoservis`+`/businesses` Indexed (post-deploy 2026-11-24: still Crawled-not-indexed; GSC Request indexing re-sent ×3)
- [x] Deepen katalog-uslug-i-ceny + vidzhet-online-zapisi + kak-perejti-s-drugoj-crm
- [x] Fast deploy: path heuristics + CI-dist path (CI workflow enabled on main `d35e08f`)
- [x] City pages → блок бизнеса со ссылками на /salon /avtoservis /kafe
- [x] Keyword→URL map (`.seoagent/strategy/keyword-url-map.md`); Wordstat API — когда будет ключ
- [x] docs/FAST-DEPLOY.md — шаги для CI workflow scope
- [x] Fill `.seoagent/okf/` for AEO (published `frontend/public/.well-known/okf/`)
- [x] Deepen `/avtoservis` pillar (FAQ + объём + SoftwareApplication) — ship 2026-11-24; + client-path/WhatsApp FAQ 2026-11-24 local
- [x] Deepen `/businesses` (client path + WhatsApp FAQ) — local 2026-11-24; needs deploy
- [x] **Deploy** money deepen v2 (2026-11-25): live after `8b97de1` (≥1600 token-words; IndexNow 200); then GSC Request indexing + weekly `seoagent indexing`
- [ ] Внешние размещения — `strategy/outreach-placements.md` (VC×3 + Zapustilis + IT-Podium + TheSaaSDir + CurlShip **live**; Product Radar + AppRater + Ignlab + SEODataPulse + Viesearch + SaaSLineup + SaaS Radius + FreeSaaSList **submitted**; Twelve.tools pending curation; PeerPush/yourhack/ListMySaaS/ToolDirs/Uneed/FoundrList/FiveTaco/AZN8/SaaS Browser/directree OTP|sign-in|logo owner; SoftFinder/s44s/Startpack/AT/SaaSHub/RuTut/mregs = owner)
- [x] Deploy deepen `/salon`+`/avtoservis`+`/businesses`+`/kafe`+compare + twelve.tools footer + sitemap all blogs + homepage SSR (2026-11-24)
- [x] Phase 4 start: city `localNote` + business spokes links (not doorway); `/o/…` quality tip → publichnaya-stranica
- [x] Phase 5 expand: OKF FAQs/article + llms.txt city/AEO anchors + `audit/aeo-prompt-checklist.md` (needs deploy for live OKF/llms)

