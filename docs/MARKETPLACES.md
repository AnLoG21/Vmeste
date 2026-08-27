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
| POST | `products/sync-catalog/` | Подтянуть карточки с Ozon/WB в историю |
| POST | `call/` | Универсальный вызов `action` Ozon/WB |
| POST | `media/` | Загрузка фото/видео |
| GET | `logs/` | Логи API провайдера |
| GET | `export/?export=csv\|xlsx` | Экспорт истории CSV/Excel |
| POST | `barcodes/generate/` | Генерация штрихкодов |
| POST | `sync/` | Фоновая синхронизация pending-импортов |
| POST | `webhook/` | Входящий webhook (по secret) |
| GET | `alerts/` | Алерты: остаток, failed-импорт, логи |
| GET/POST/DELETE | `reply-templates/` | Шаблоны ответов на отзывы/вопросы |
| GET | `reprice/logs/` | Лог СПП-репрайса |
| POST | `reprice/spp/` | План/применение СПП-цен (`apply`, `rules`, `observations`) |

### Аналитика (вкладка)

- Период + фильтр SKU, KPI, пузырьки SKU, теплокарта складов
- WB `analytics.nm_report` — воронка карточка→корзина→заказ→выкуп
- Склад: в пути / дни запаса; юнит-экономика с себестоимостью (`sku_costs` в settings)
- СПП-правила (`spp_rules`, `spp_reprice_enabled`); в sandbox цены не уходят на WB
- Доп. WB actions: `tariffs.commission`, `tariffs.box`, `products.prices_list`

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

## Синхронизация статусов и webhook

Это **не** выгрузка каталога, а обновление статусов уже отправленных карточек Ozon.

| Действие | Что делает |
|----------|------------|
| «Обновить статусы выгрузки» / `POST /sync/` | Спрашивает Ozon по `task_id`: карточка уже принята или ошибка — пишет в историю |
| Celery Beat (каждые 15 мин) | То же самое фоном для всех pending |
| Webhook | Внешний cron/n8n дергает `POST /webhook/` с секретом и ставит тот же синк в очередь |

1. В **Управление** нажмите «Создать секрет webhook» — секрет показывается один раз.
2. URL: `https://<ваш-домен>/api/marketplaces/webhook/`
3. Секрет: заголовок `Authorization: Bearer …`, `?secret=` или JSON `{ "secret": "…" }`.

### Подтянуть каталог с площадки

`POST /products/sync-catalog/` (кнопка «Подтянуть с площадки» во вкладке Товары) — читает карточки Ozon/WB и пишет/обновляет локальную историю. Нужен боевой режим. Учитывайте лимит API (~2 запроса/сек).

- Перед выгрузкой карточки проверяются: артикул, название, категория/тип, обязательные атрибуты, хотя бы одно фото с публичным URL. Ошибки API (rate limit, тариф отзывов и т.п.) показываются коротко по-русски.
- Слайды витрины: в «Создать товар» — свои шаблоны (`/card-designs/`: макет, цвета, подписи), генерация PNG поверх реального фото; есть стартовые шаблоны.

Клонирование Ozon↔WB: кнопка «Клонировать на …» копирует поля формы на другую площадку; категорию нужно выбрать заново.

### Отзывы, вопросы, аналитика, алерты

- Отзывы + фильтр «без ответа»; шаблоны ответов (`/reply-templates/`).
- Вопросы WB: список и ответ (`questions.list` / `questions.answer`).
- Аналитика: период/SKU, KPI, воронка WB, склад (дни запаса), пузырьки + теплокарта, юнит с себестоимостью, СПП-репрайс + лог.
- Алерты: `GET /alerts/` — низкий остаток, failed-импорт, **актуальные** ошибки логов (последний вызов endpoint ещё с ошибкой; после успешного повтора алерт пропадает).
- Контроль цены: защита от автоскидок, «макс. снижение цены, %», отключение автоакций Ozon.
- Уведомления Telegram/push о новых заказах и ошибках синка (настройки в Управлении; Celery `poll_new_orders`).
- Роли сотрудников: `marketplace_view_keys` / `marketplace_manage_orders` / `marketplace_manage_catalog`.
- Связка заказа с чатом: `POST /orders/link-chat/`.
- Дашборд «что сломалось»: `GET /ops/summary/?hours=24`; sync-задачи с retry и Redis-dedup.

Sandbox e2e-тесты (без живого API): `python manage.py test marketplaces.tests_e2e_sandbox`.

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
