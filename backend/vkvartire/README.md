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

## Чат с риелтором

1. В админке у объявления укажите **Realtor** (пользователь Вместе) — появится кнопка «Написать риелтору».
2. Опционально: `realtor_name` / `realtor_phone` / `realtor_email` для телефона, если аккаунта нет.
3. API: `POST /api/vkvartire/listings/<id>/chat/` → создаёт user-direct чат + intro-сообщение.

## Официальные фиды Avito / Циан

**Не парсим сайты.** Нужны партнёрские XML-выгрузки (Autoload Avito, Cian/Yandex-Realty XML от агентства).

```bash
# .env
VKUARTIRE_AVITO_FEED_URL=https://partner.example/avito.xml
VKUARTIRE_CIAN_FEED_URL=https://partner.example/cian.xml

python manage.py fetch_vkvartire_feeds
```

Крон раз в час:

```cron
0 * * * * cd /app && python manage.py fetch_vkvartire_feeds >> /var/log/vkvartire-feeds.log 2>&1
```

Дедуп: `(source, external_id)` или `fingerprint`.

## Переменные окружения (Вквартире + карты)

| Переменная | Где | Зачем |
|---|---|---|
| `YANDEX_MAPS_API_KEY` | корневой `.env` | Карта + fallback Router |
| `YANDEX_ROUTING_API_KEY` | корневой `.env` | Distance Matrix ETA (пешком/транспорт); если пусто — берётся Maps key |
| `VITE_YANDEX_MAPS_API_KEY` | `frontend/.env` | Карты в браузере |
| `VITE_YANDEX_SUGGEST_API_KEY` | `frontend/.env` | Подсказки адресов (иначе Photon) |
| `VKUARTIRE_AVITO_FEED_URL` | корневой `.env` | HTTPS URL официального Avito Autoload XML |
| `VKUARTIRE_CIAN_FEED_URL` | корневой `.env` | HTTPS URL партнёрского Cian/Yandex-Realty XML |

Без Routing-ключа фильтр минут работает по прямой (~80 м/мин). Без feed URL команда `fetch_vkvartire_feeds` ничего не качает.

## Уведомления

Сохранённый поиск с `notify=true` → in-app/push при **создании** подходящего объявления.
