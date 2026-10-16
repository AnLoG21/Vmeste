# Вквартире

Микросервис подбора квартир (аренда / продажа) внутри Вместе.

## Команды

```bash
python manage.py migrate vkvartire
python manage.py migrate notifications
python manage.py seed_vkvartire
python manage.py import_listings path/to/listings.json
python manage.py fetch_vkvartire_feeds          # по URL из .env
python manage.py fetch_vkvartire_feeds --dry-run
```

Пример JSON: [`samples/listings.example.json`](samples/listings.example.json).

## Карты и удалённость (без платных Яндекс API)

- **Карта** — как в остальном Вместе (`loadYandexMaps` / то, что уже настроено). Отдельные ключи Router / Suggest для Вквартире **не требуются**.
- **Фильтр «минуты»** — только приближение по прямой (haversine): пешком ~80 м/мин, транспорт ~220 м/мин.
- **Подсказки адреса** — Photon (бесплатно); Яндекс Suggest не нужен.

## Чат с риелтором

1. В админке у объявления укажите **Realtor** (пользователь Вместе) — кнопка «Написать риелтору».
2. Опционально: `realtor_name` / `realtor_phone` / `realtor_email`.
3. API: `POST /api/vkvartire/listings/<id>/chat/`.

## Официальные фиды Avito / Циан

**Не парсим сайты.** Нужны партнёрские XML-выгрузки.

```bash
# .env
VKUARTIRE_AVITO_FEED_URL=https://partner.example/avito.xml
VKUARTIRE_CIAN_FEED_URL=https://partner.example/cian.xml

python manage.py fetch_vkvartire_feeds
```

Дедуп: `(source, external_id)` или `fingerprint`.

## Переменные окружения только для Вквартире

| Переменная | Обязательно? | Зачем |
|---|---|---|
| `VKUARTIRE_AVITO_FEED_URL` | нет | HTTPS URL Autoload XML партнёра |
| `VKUARTIRE_CIAN_FEED_URL` | нет | HTTPS URL Cian / Yandex-Realty XML партнёра |

Никаких `YANDEX_ROUTING_*` для сервиса не нужно.

## Уведомления

Сохранённый поиск с `notify=true` → in-app/push при создании подходящего объявления.
