# Keyword → URL map (фаза 2)

Ручная привязка до Wordstat. `keywords.md` из cloud — read-only; этот файл — рабочий.

| Intent / запрос | Посадочная | Приоритет |
|---|---|---|
| онлайн-запись для салона красоты | `/salon` | P0 |
| запись клиентов вместо WhatsApp | `/blog/zapis-vmesto-whatsapp` → `/salon` | P0 |
| программа для автосервиса / онлайн-запись СТО | `/avtoservis` | P0 |
| QR меню для кафе | `/kafe` + `/blog/qr-menyu-dlya-kafe-kak-zapustit` | P0 |
| yclients альтернатива / dikidi | `/blog/chem-vmeste-otlichaetsya-ot-yclients-i-dikidi` | P1 |
| виджет онлайн записи на сайт | `/blog/vidzhet-online-zapisi-na-sajt` | P1 |
| каталог услуг салон | `/blog/katalog-uslug-i-ceny` | P1 |
| переход с CRM / миграция | `/blog/kak-perejti-s-drugoj-crm` | P1 |
| онлайн-запись для бизнеса | `/businesses` | P1 |
| напоминания о записи | `/blog/napominaniya-o-zapisi-klientam` | P2 |
| QR меню / экран кухни | `/blog/ekran-kuhni-dlya-kafe` | P2 |
| запись в {город} (бренд+локаль) | `/city/{slug}` → блок бизнеса → `/salon` | P2 |

## Wordstat (когда будет ключ)

```bash
# config в ~/.agents/skills/yandex-wordstat/config/
# затем топ по:
# «онлайн запись салон», «программа автосервис», «qr меню кафе», «yclients альтернатива»
```

Регион: Россия / Москва+МО по ICP. Сверить title/H1 посадочных с топ-формулировками.
