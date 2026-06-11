# Настройка Gmail и ЮKassa для Vmeste

## 1. Gmail (почта)

### Шаг 1. Подготовка аккаунта Google

1. Войдите в [Google Account](https://myaccount.google.com/) для `vmesteofficialsupport@gmail.com`.
2. Включите **двухэтапную аутентификацию**: Безопасность → Двухэтапная аутентификация.
3. Создайте **пароль приложения**:
   - Безопасность → Пароли приложений (или поиск «App passwords»).
   - Приложение: «Почта», устройство: «Другое» → `Vmeste`.
   - Скопируйте 16-символьный пароль (без пробелов).

### Шаг 2. Заполните `.env`

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=1
EMAIL_HOST_USER=vmesteofficialsupport@gmail.com
EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx
DEFAULT_FROM_EMAIL=Vmeste <vmesteofficialsupport@gmail.com>
SUPPORT_EMAIL=vmesteofficialsupport@gmail.com
SKIP_EMAIL_VERIFICATION=0
```

### Шаг 3. Перезапуск и проверка

```bash
docker compose restart web
docker compose exec web python manage.py test_email
```

Письмо должно прийти на `SUPPORT_EMAIL`. Для другого адреса:

```bash
docker compose exec web python manage.py test_email your@email.com
```

### Частые ошибки Gmail

| Ошибка | Решение |
|--------|---------|
| `535 Authentication failed` | Неверный пароль приложения (не обычный пароль Gmail) |
| `SMTP не настроен` | Пустой `EMAIL_HOST_PASSWORD` в `.env` |
| Письмо в спаме | Проверьте папку «Спам», добавьте отправителя в контакты |

---

## 2. ЮKassa (оплата подписок)

### Шаг 1. Регистрация

1. Зарегистрируйтесь на [yookassa.ru](https://yookassa.ru).
2. В личном кабинете создайте или выберите **тестовый магазин** (для разработки).

### Шаг 2. Получите ключи

1. Личный кабинет → ваш **тестовый** магазин.
2. **Интеграция** → **Ключи API** → **Выпустить секретный ключ**.
3. Скопируйте:
   - **shopId** (идентификатор магазина, число)
   - **Секретный ключ** (начинается с `test_` для тестового магазина)

### Шаг 3. Заполните `.env`

```env
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Шаг 4. Перезапуск и проверка

```bash
docker compose restart web
docker compose exec web python manage.py test_yookassa
```

Команда создаст тестовый платёж на 1 ₽ и выведет ссылку для оплаты.

### Шаг 5. HTTP-уведомления (webhook)

Для **локальной** разработки ЮKassa не сможет достучаться до `localhost`. Варианты:

**Вариант A — без webhook (достаточно для старта)**  
После оплаты пользователь возвращается на сайт (`return_url`), фронтенд вызывает `POST /api/subscriptions/confirm/` — подписка активируется.

**Вариант B — webhook через туннель (ngrok / cloudflared)**

1. Установите [ngrok](https://ngrok.com/) или cloudflared.
2. Пробросьте порт 8000:
   ```bash
   ngrok http 8000
   ```
3. В ЮKassa: **Интеграция** → **HTTP-уведомления** → URL:
   ```
   https://ВАШ-ID.ngrok-free.app/api/subscriptions/webhook/yookassa/
   ```
4. Включите событие `payment.succeeded`.

### Тестовая карта ЮKassa

При оплате в тестовом магазине используйте [тестовые карты](https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing):

- Успешная оплата: `5555 5555 5555 4444`, срок любой будущий, CVC любой.

### Продакшен

1. Пройдите модерацию и подключите **боевой** магазин.
2. Замените ключи на боевые (секретный ключ **без** префикса `test_`).
3. Укажите webhook на ваш домен:
   ```
   https://ваш-домен.ru/api/subscriptions/webhook/yookassa/
   ```

---

## Безопасность

- **Никогда** не коммитьте `.env` в git.
- Пароль Gmail — только **пароль приложения**, не основной пароль аккаунта.
- Если пароль попал в чат или репозиторий — удалите его в Google и создайте новый.
