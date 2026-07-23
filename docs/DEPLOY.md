# Публикация Vmeste в интернет

Проект: Django API + React (nginx) + PostgreSQL + Redis. Для продакшена нужны HTTPS, постоянный диск (БД, медиа), webhook ЮKassa.

---

## Сравнение вариантов (дешево + функционально)

| Вариант | Цена/мес | Плюсы | Минусы |
|---------|----------|-------|--------|
| **VPS + Docker** (рекомендуется) | 300–600 ₽ | Полный контроль, весь стек как локально, webhook, медиа | Нужно настроить сервер один раз |
| Timeweb / Selectel / Hetzner VPS | от ~300 ₽ / ~4 € | Стабильно, РФ или EU | Администрирование |
| Railway / Render | $5–20+ | Проще деплой | БД + Redis дороже, лимиты |
| Frontend на Cloudflare Pages + API на VPS | ~300 ₽ | CDN бесплатно | Два места настройки, CORS |
| Beget shared hosting | ~200 ₽ | Дёшево | **Не подходит** — нет Docker, сложно с PostgreSQL |

**Оптимум по цене и возможностям:** один VPS (2 GB RAM, 1 vCPU) + Docker Compose + Caddy (бесплатный HTTPS).

Пример бюджета:
- VPS Timeweb/Selectel: **~350 ₽/мес**
- Домен `.ru`: **~200–500 ₽/год**
- SSL: **бесплатно** (Let's Encrypt через Caddy)
- Почта Gmail: **бесплатно**
- ЮKassa: комиссия с платежей

---

## Что нужно перед публикацией

1. **Домен** — например `vmeste.ru` (reg.ru, nic.ru, Timeweb).
2. **VPS** — Ubuntu 22.04/24.04, минимум 2 GB RAM.
3. **Продакшен `.env`** — см. `.env.example`, `DEBUG=0`, сильный `SECRET_KEY`.
4. **ЮKassa** — боевой магазин + webhook URL.
5. **Gmail** — пароль приложения (уже настраивали).

---

## Пошагово: VPS + Docker (рекомендуемый путь)

### Шаг 1. Аренда VPS

Подойдут:
- [Timeweb Cloud](https://timeweb.cloud) — от ~350 ₽, серверы в РФ
- [Selectel](https://selectel.ru) — от ~400 ₽
- [Hetzner](https://www.hetzner.com) — от ~4 €, дешевле в EU

При создании выберите **Ubuntu 22.04**, добавьте SSH-ключ.

### Шаг 2. DNS домена

В панели регистратора домена:

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | IP вашего VPS |
| A | `www` | IP вашего VPS |

Подождите 5–30 минут (иногда до 24 ч).

### Шаг 3. Подключение к серверу

```bash
ssh root@ВАШ_IP
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2 git
```

### Шаг 4. Клонирование проекта

```bash
git clone https://github.com/AnLoG21/Vmeste.git /opt/vmeste
cd /opt/vmeste
```

### Шаг 5. Продакшен `.env`

```bash
cp .env.example .env
nano .env
```

Обязательно измените:

```env
DEBUG=0
SECRET_KEY=длинная-случайная-строка-50+символов
ALLOWED_HOSTS=vmeste.ru,www.vmeste.ru,api.vmeste.ru
FRONTEND_URL=https://vmeste.ru

POSTGRES_PASSWORD=надёжный-пароль
EMAIL_HOST_PASSWORD=пароль-приложения-gmail
YOOKASSA_SHOP_ID=боевой-shopId
YOOKASSA_SECRET_KEY=боевой-ключ-без-test_
```

### Шаг 6. Продакшен Docker Compose

Используйте `docker-compose.prod.yml` (см. ниже в репозитории) или адаптируйте текущий:

- **Gunicorn** вместо `runserver`
- **Caddy** — HTTPS и прокси на фронт + API
- PostgreSQL и Redis **без** публичных портов
- Том для `media/` (загруженные фото)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Шаг 7. ЮKassa webhook

В личном кабинете ЮKassa → Интеграция → HTTP-уведомления:

```
https://vmeste.ru/api/subscriptions/webhook/yookassa/
```

Событие: `payment.succeeded`.

### Шаг 8. Проверка

- https://vmeste.ru — главная
- https://vmeste.ru/api/users/roles/ — API
- Регистрация → письмо на почту
- Тестовый платёж подписки

---

## Важные изменения для продакшена

Текущий `docker-compose.yml` — **только для разработки**:

| Сейчас (dev) | Нужно (prod) |
|--------------|--------------|
| `runserver` | **Gunicorn** (4 воркера) |
| `DEBUG=1` | `DEBUG=0` |
| Порты 5433, 6379 наружу | Закрыть, только внутри Docker |
| `VITE_API_URL=localhost` | `https://ваш-домен.ru/api` |
| Медиа в контейнере | Том `media_data` на диске |
| Нет HTTPS | Caddy / nginx + Let's Encrypt |

---

## Схема продакшена

```
Интернет
   │
   ▼
[Caddy :443 HTTPS]
   ├── /        → frontend (nginx, React)
   ├── /api     → web (Gunicorn + Django)
   ├── /admin   → web
   └── /media   → volume vmeste_media (Caddy file_server; Django fallback)
         │
    [PostgreSQL] [Redis]
```

---

## Обслуживание

```bash
# Обновление после git push
cd /opt/vmeste && git pull
docker compose -f docker-compose.prod.yml up -d --build

# Логи
docker compose -f docker-compose.prod.yml logs -f web

# Бэкап БД (раз в день через cron)
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U vmeste_user vmeste > backup_$(date +%F).sql
```

---

## Альтернатива: раздельный деплой

Если хотите ещё дешевле на старте:

1. **Фронт** — [Cloudflare Pages](https://pages.cloudflare.com) (бесплатно): сборка `npm run build`, env `VITE_API_URL=https://api.ваш-домен.ru/api`
2. **API + БД** — минимальный VPS только для backend

Минус: два домена (`vmeste.ru` + `api.vmeste.ru`), настройка CORS.

---

## Чеклист перед запуском

- [ ] `DEBUG=0`
- [ ] Уникальный `SECRET_KEY`
- [ ] `ALLOWED_HOSTS` с доменом
- [ ] HTTPS работает
- [ ] Почта отправляется (`python manage.py test_email`)
- [ ] ЮKassa боевые ключи + webhook
- [ ] Бэкапы PostgreSQL
- [ ] Создан суперпользователь: `docker compose exec web python manage.py createsuperuser`

---

## Нужна помощь с настройкой?

Можно подготовить в репозитории готовые файлы:
- `docker-compose.prod.yml`
- `Caddyfile`
- Gunicorn в `requirements.txt`

Скажите домен и хостинг — настроим под ваш случай.
