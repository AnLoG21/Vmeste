# Маркетплейсы (Ozon / Wildberries)

Кабинет исполнителя со сферой **Маркетплейсы**: выгрузка карточек, медиа, заказы, отзывы, финансы Ozon, логи API.

---

## Быстрый старт

1. Войдите как исполнитель со сферой «Маркетплейсы».
2. **Меню → Управление** — вставьте ключи Ozon (Client ID + API Key) и/или Wildberries API Key.
3. Включите **Боевой** режим, когда готовы к реальным запросам (в песочнице запись на площадку не уходит).
4. Подключите **Яндекс Диск** (по желанию) — публичные URL фото для карточек.
5. **Создать товар** → загрузите категории с площадки → заполните карточку → «Выгрузить».

---

## API (префикс `/api/marketplaces/`)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET/PATCH | `settings/` | Ключи, режим, webhook secret |
| GET | `history/` | История выгрузок |
| POST | `products/import/` | Выгрузка карточек |
| POST | `products/import-status/` | Статус задачи Ozon |
| POST | `products/fetch/` | Загрузка карточки с площадки |
| POST | `call/` | Универсальный вызов `action` Ozon/WB |
| POST | `media/` | Загрузка фото/видео |
| GET | `logs/` | Логи API провайдера |
| GET | `export/?export=csv\|xlsx` | Экспорт истории CSV/Excel |
| POST | `barcodes/generate/` | Генерация штрихкодов |
| POST | `sync/` | Фоновая синхронизация pending-импортов |
| POST | `webhook/` | Входящий webhook (по secret) |

Авторизация: JWT / session как у остального кабинета.  
`webhook/` — без логина, секрет в `Authorization: Bearer …`, `?secret=` или JSON `{ "secret": "…" }`.

---

## Экспорт CSV / Excel

- В UI: **Товары → Экспорт CSV**, также кнопки для заказов/отзывов.
- С сервера: `GET /api/marketplaces/export/?export=csv` или `export=xlsx` (нужен пакет `openpyxl`). Не используйте `?format=` — его перехватывает DRF.
- CSV с BOM и разделителем `;` — удобно открывать в Excel.

---

## Логи API

Каждый вызов Ozon/WB пишется в `MarketplaceApiLog` (метод, URL, статус, ошибка).  
В кабинете: вкладка **Логи** (или блок в Управлении) — последние запросы текущего провайдера.

---

## Штрихкоды Ozon / WB

`POST /api/marketplaces/barcodes/generate/`

- Новая карточка Ozon (нет `product_id`): `{ "marketplace": "ozon", "local": true }` → локальный EAN-13.
  API Ozon требует `product_ids` (1–100) уже созданного товара — без них была ошибка validation.
- Существующий товар Ozon: `{ "marketplace": "ozon", "product_ids": ["123"] }`
- WB: `{ "marketplace": "wildberries", "count": 1 }`

Кнопка в форме сама выбирает local или product_ids.

## Этикетки FBS (Ozon)

`POST /api/marketplaces/orders/label/` — `{ "posting_numbers": ["…"] }` → PDF (через ~1 мин после сборки).

---

## Финансы и акции Ozon

Через универсальный `POST /api/marketplaces/call/`:

- `action`: `finance.list` — транзакции  
- `action`: `actions.list` — акции  

В UI: вкладка **Финансы** (Ozon).

---

## Склады и поставки

- **Склады** Ozon/WB: выбор в «Управление» (остатки) и «Заказы» (фильтр Ozon). Выбор сохраняется в браузере.
- **Поставки WB FBS** (вкладка «Поставки»): `supplies.create` → добавить заказы (`supplies.add_order`) → `supplies.deliver` (в доставку). Удаление пустой: `supplies.delete`.

---

## Webhook и фоновая синхронизация

1. В **Управление** нажмите «Создать webhook secret» — секрет показывается один раз.
2. URL: `https://<ваш-домен>/api/marketplaces/webhook/`
3. Вызов с секретом ставит в очередь синк pending-импортов Ozon для этой организации.
4. Celery Beat каждые **15 минут** запускает `marketplaces.sync_pending_imports` для всех pending-задач.
5. Ручной синк: `POST /api/marketplaces/sync/` из кабинета.

Задача обновляет статус истории (`pending` → `success`/`failed`) и записывает `product_id`.

---

## Чеклист продакшена

- [ ] Ключи Ozon/WB в боевом режиме  
- [ ] Яндекс Диск или публичные HTTPS URL фото  
- [ ] Celery worker + beat запущены (`docker compose` сервисы `celery_worker`, `celery_beat`)  
- [ ] Миграции `marketplaces` применены  
- [ ] При необходимости — webhook secret и мониторинг `/logs/`  

---

## Тесты

```bash
cd backend
python manage.py test marketplaces
```

Покрывают хелперы клиентов, логи, экспорт CSV, webhook, ротацию secret (без живых вызовов Ozon/WB).
