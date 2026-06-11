# Vmeste

Платформа для записи на услуги: React-фронтенд, Django REST API, PostgreSQL, Redis.

## Стек

| Компонент | Технология |
|-----------|------------|
| Фронтенд | React 18 + Vite |
| Бэкенд | Django 5 + DRF + JWT |
| БД | PostgreSQL 16 |
| Кэш / брокер | Redis 7 |
| Запуск | Docker Compose |

---

## Быстрый старт (Docker — рекомендуется)

### Шаг 1. Установите Docker

1. Скачайте и установите [Docker Desktop](https://www.docker.com/products/docker-desktop/) для Windows.
2. Запустите Docker Desktop и дождитесь статуса **Running**.
3. Проверьте в терминале:

```powershell
docker --version
docker compose version
```

### Шаг 2. Перейдите в папку проекта

```powershell
cd C:\Users\analo\projects\vmeste\Vmeste
```

### Шаг 3. Настройте переменные окружения

Файл `.env` в корне проекта уже создан. При необходимости отредактируйте его:

```powershell
notepad .env
```

Минимально важные переменные:

| Переменная | Назначение |
|------------|------------|
| `SECRET_KEY` | Секрет Django (смените в продакшене) |
| `DEBUG` | `1` — режим разработки |
| `POSTGRES_PASSWORD` | Пароль БД (должен совпадать с `docker-compose.yml` → `vmeste_pass`) |
| `FRONTEND_URL` | URL фронтенда для CORS |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP для писем подтверждения и заявок |
| `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` | Оплата подписок через ЮKassa |

### Шаг 4. Запустите все сервисы

```powershell
docker compose up --build
```

Первый запуск займёт несколько минут (скачивание образов, сборка, миграции БД).

Чтобы запустить в фоне:

```powershell
docker compose up --build -d
```

### Шаг 5. Откройте приложение

| Сервис | URL |
|--------|-----|
| Фронтенд | http://localhost:5173 |
| API | http://localhost:8000/api |
| Админка Django | http://localhost:8000/admin |

### Шаг 6. Создайте суперпользователя (админ)

В **новом** терминале:

```powershell
cd C:\Users\analo\projects\vmeste\Vmeste
docker compose exec web python manage.py createsuperuser
```

Введите email, имя и пароль — затем войдите в админку по адресу http://localhost:8000/admin.

### Шаг 7. Остановка

```powershell
docker compose down
```

Данные PostgreSQL сохраняются в Docker-томе `vmeste_pgdata`. Чтобы удалить и данные:

```powershell
docker compose down -v
```

---

## Локальная разработка без Docker

Нужны: Python 3.12, Node.js 20, PostgreSQL 16, Redis 7.

### Бэкенд

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Создайте `.env` в **корне** репозитория (`Vmeste/.env`) с локальными настройками:

```env
DEBUG=1
SECRET_KEY=dev-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1
SKIP_EMAIL_VERIFICATION=1
FRONTEND_URL=http://localhost:5173

POSTGRES_DB=vmeste
POSTGRES_USER=vmeste_user
POSTGRES_PASSWORD=vmeste_pass
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

REDIS_URL=redis://localhost:6379/0
```

Создайте БД в PostgreSQL, затем:

```powershell
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API будет на http://localhost:8000.

### Фронтенд

В отдельном терминале:

```powershell
cd frontend
npm install
```

Файл `frontend/.env` уже создан. Запуск:

```powershell
npm run dev
```

Фронтенд: http://localhost:5173.

---

## Переменные окружения

### Корневой `.env` (бэкенд + Docker)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DEBUG` | `0` | `1` — отладка, открытый CORS, медиафайлы |
| `SECRET_KEY` | — | Секретный ключ Django |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Разрешённые хосты |
| `FRONTEND_URL` | `http://localhost:5173` | URL фронтенда (CORS) |
| `SKIP_EMAIL_VERIFICATION` | `0` | `1` — пропускать верификацию email |
| `POSTGRES_*` | см. `.env.example` | Подключение к PostgreSQL |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis |
| `CELERY_BROKER_URL` | = REDIS_URL | Брокер Celery |
| `CELERY_RESULT_BACKEND` | = REDIS_URL | Результаты Celery |

### `frontend/.env` (Vite, только при `npm run dev`)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `VITE_API_URL` | `http://localhost:8000/api` | Базовый URL API |
| `VITE_YANDEX_MAPS_API_KEY` | — | Опционально, Яндекс.Карты |
| `VITE_YANDEX_SUGGEST_API_KEY` | — | Опционально, подсказки адресов |

> При запуске через Docker `VITE_API_URL` задаётся в `docker-compose.yml` (build arg) на этапе сборки образа.

---

## Полезные команды

```powershell
# Логи всех сервисов
docker compose logs -f

# Логи только бэкенда
docker compose logs -f web

# Пересобрать после изменений во фронтенде (Docker)
docker compose up --build frontend

# Миграции вручную
docker compose exec web python manage.py migrate

# Подключение к БД с хоста (порт 5433, не 5432)
# psql -h localhost -p 5433 -U vmeste_user -d vmeste
```

---

## Структура проекта

```
Vmeste/
├── backend/          # Django API
│   ├── config/       # Настройки, URLs
│   ├── users/        # Пользователи, авторизация
│   ├── catalog/      # Каталог услуг
│   ├── booking/      # Записи
│   ├── locations/    # Локации
│   ├── chat/         # Чат
│   ├── notifications/
│   └── reviews/
├── frontend/         # React SPA
├── docker-compose.yml
├── .env              # Переменные (не в git)
└── .env.example      # Шаблон переменных
```

---

## Почта и подтверждение регистрации

1. В Gmail включите двухфакторную аутентификацию и создайте **пароль приложения**.
2. Укажите его в `.env` → `EMAIL_HOST_PASSWORD`.
3. Установите `SKIP_EMAIL_VERIFICATION=0`.
4. После регистрации пользователь получает письмо со ссылкой вида `http://localhost:5173?verify_email=...`.
5. Вход без подтверждения email заблокирован.

Заявки на индивидуальную автоматизацию отправляются на `SUPPORT_EMAIL` (по умолчанию vmesteofficialsupport@gmail.com). Письмо идёт **с сервера**, в поле Reply-To указывается email заявителя — ответить можно напрямую клиенту.

---

## Подписки и ЮKassa

1. Зарегистрируйтесь в [ЮKassa](https://yookassa.ru) и получите `shopId` и секретный ключ.
2. Добавьте их в `.env`.
3. В меню приложения откройте **Подписки** — оплата, продление, автопродление.
4. Webhook для уведомлений: `POST /api/subscriptions/webhook/yookassa/`.
5. Без ключей ЮKassa подписка активируется в тестовом режиме (для разработки).

---

## API

| Путь | Описание |
|------|----------|
| `POST /api/auth/token/` | Вход (JWT) |
| `POST /api/auth/token/refresh/` | Обновление токена |
| `/api/users/` | Пользователи |
| `/api/catalog/` | Каталог |
| `/api/booking/` | Записи |
| `/api/locations/` | Локации |
| `/api/chat/` | Чат |
| `/api/notifications/` | Уведомления |
| `/api/reviews/` | Отзывы |
| `/api/subscriptions/` | Тарифы, подписки, оплата |
| `POST /api/users/automation-request/` | Заявка на автоматизацию |
