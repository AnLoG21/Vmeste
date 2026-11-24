# Content / SEO roadmap — vsevmeste.space

Cluster order: salon-booking (ICP) → autoservice → cafe-qr → compare-crm

## Cluster: salon-booking

- [x] PILLAR  salon — "онлайн запись для салона красоты" (expanded 2026-11-24)
- [x] SUB     kak-nastroit-online-zapis-v-salone — expanded + FAQ + internal links
- [x] SUB     zapis-vmesto-whatsapp — expanded + FAQ + pricing
- [ ] SUB     zapis-dlya-solo-mastera — "онлайн запись для мастера"
- [ ] LONG_TAIL napominaniya-o-zapisi-klientam — "напоминания о записи"
- [ ] LONG_TAIL kak-snizit-neprihody-predoplata — "предоплата запись салон"
- [ ] LONG_TAIL kak-nastroit-zapis-neskolkih-masterov — "запись несколько мастеров"

## Cluster: autoservice

- [x] PILLAR  avtoservis — partial expand ("что выбрать")
- [ ] SUB     online-zapis-v-avtoservise
- [ ] SUB     programma-dlya-avtoservisa-chto-vybrat — deepen further
- [ ] LONG_TAIL priemka-v-avtoservise-foto-defektov

## Cluster: cafe-qr

- [x] PILLAR  kafe — expanded FAQ + payment + kitchen links
- [ ] SUB     qr-menyu-dlya-kafe-kak-zapustit
- [ ] LONG_TAIL ekran-kuhni-dlya-kafe

## Cluster: compare-crm

- [x] PILLAR  chem-vmeste-otlichaetsya-ot-yclients-i-dikidi — FAQ + pricing honesty
- [ ] SUB     chem-vmeste-otlichaetsya-ot-aggregatorov

## Long-tails from cloud briefs

- [x] sinhronizaciya-s-google-i-yandex-kalendarem (supersedes brief `google`)
- [x] telegram-napominaniya-organizacii (supersedes brief `telegram-sms`)

## Ops / technical

- [x] Deploy prior SEO commit; sitemap Caddy timeouts
- [ ] After this deploy: GSC URL Inspection / request indexing for /salon /avtoservis /businesses + money posts
- [ ] Re-run `seoagent indexing --max 40`
- [ ] Fill `.seoagent/okf/` + sync for AEO
- [ ] IndexLift /salon: 99/100 — fix remaining WARN (sitemap discovery fluke under load, regional signals)
