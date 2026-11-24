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
- [ ] Weekly `seoagent indexing` until `/salon`+`/avtoservis` Indexed (2026-11-24 12:30Z sample 10: salon/avtoservis still **Crawled not indexed**; `/kafe` Indexed; IndexNow re-ping after deepen)
- [x] Deepen katalog-uslug-i-ceny + vidzhet-online-zapisi + kak-perejti-s-drugoj-crm
- [x] Fast deploy: path heuristics + CI-dist path (CI workflow enabled on main `d35e08f`)
- [x] City pages → блок бизнеса со ссылками на /salon /avtoservis /kafe
- [x] Keyword→URL map (`.seoagent/strategy/keyword-url-map.md`); Wordstat API — когда будет ключ
- [x] docs/FAST-DEPLOY.md — шаги для CI workflow scope
- [x] Fill `.seoagent/okf/` for AEO (published `frontend/public/.well-known/okf/`)
- [x] Deepen `/avtoservis` pillar (FAQ + объём + SoftwareApplication) — ship 2026-11-24
- [ ] Внешние размещения — `strategy/outreach-placements.md` (Product Radar **submitted**; IT-Podium/Zapustilis **live**; VC 4a+4b+4c **live**; Zapustilis badge pushed `2f8d6b5` — confirm after VPS deploy; Startpack/SaaSHub/AT/RuTut/mregs = owner)
