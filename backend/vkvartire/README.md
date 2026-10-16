# Вквартире

Микросервис подбора квартир (аренда / продажа).

## Команды

```bash
python manage.py migrate vkvartire
python manage.py migrate notifications   # kind=vkvartire
python manage.py seed_vkvartire
python manage.py import_listings path/to/listings.json
```

Пример JSON: [`samples/listings.example.json`](samples/listings.example.json).

Дедуп: `(source, external_id)` или `fingerprint` (адрес + комнаты + площадь + корзина цены + deal_type).

## Маршрутизация (ETA)

Если задан `YANDEX_ROUTING_API_KEY` или `YANDEX_MAPS_API_KEY`, фильтр «минуты до точки» уточняется через Distance Matrix (`walking` / `transit`). Иначе — haversine (~80 м/мин).

## Уведомления

Сохранённый поиск с `notify=true` получает in-app/push при **создании** подходящего объявления (signal + импорт).

## Коннекторы Avito / Циан

Парсинг сайтов не входит в продукт. Подключайте легальные выгрузки/API партнёра → JSON → `import_listings`. Поля `source`, `external_id`, `external_url` уже в модели.
