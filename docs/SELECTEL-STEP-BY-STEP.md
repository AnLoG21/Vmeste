# Пошаговый деплой на Selectel (с нуля)

Бюджет: VPS 400 ₽/мес + домен.

---

## ЧАСТЬ 1. Создание сервера в Selectel

### Поля при создании VPS

| Поле | Что выбрать |
|------|-------------|
| **ОС** | Ubuntu 22.04 LTS (или 24.04) |
| **2 vCPU / 2 GB / 40 GB** | Ваш тариф — подходит |
| **SSH-ключ** | См. ниже — **рекомендуется** |
| **Пароль root** | Сильный пароль — **заполните обязательно** как запасной вход |

### SSH-ключ — что это и зачем

**SSH-ключ** — безопасный вход на сервер без пароля (как «цифровой ключ»).

**Рекомендация:** и ключ, и пароль.
- Ключ — для ежедневной работы
- Пароль — если потеряете ключ, сможете войти через консоль Selectel

#### Создать ключ на Windows (PowerShell)

```powershell
ssh-keygen -t ed25519 -C "vmeste-selectel" -f $env:USERPROFILE\.ssh\selectel_vmeste
```

На вопрос passphrase нажмите **Enter** (пусто) или задайте доп. пароль.

Показать публичный ключ (его вставляете в Selectel):

```powershell
Get-Content $env:USERPROFILE\.ssh\selectel_vmeste.pub
```

Скопируйте всю строку (`ssh-ed25519 AAAA... vmeste-selectel`).

#### В панели Selectel

1. **Облачная платформа** → **SSH-ключи** → **Добавить ключ**
2. Вставьте скопированную строку, имя: `vmeste`
3. При создании сервера в поле **SSH-ключ** выберите `vmeste`

#### Пароль root

Придумайте длинный пароль (16+ символов, буквы+цифры).  
**Сохраните в надёжном месте** — понадобится для консоли Selectel.

### После создания

Запишите **публичный IP** сервера (например `185.x.x.x`).

---

## ЧАСТЬ 2. Домен → IP сервера

В панели **регистратора домена** (не Selectel, если домен куплен elsewhere):

| Тип | Имя (хост) | Значение |
|-----|------------|----------|
| **A** | `@` | IP сервера Selectel |
| **A** | `www` | тот же IP |

Пример: домен `vmeste.ru`, IP `185.12.34.56` → обе A-записи на `185.12.34.56`.

Подождите **15–60 минут** (иногда до 24 ч).

Проверка с вашего ПК:

```powershell
nslookup ваш-домен.ru
```

Должен показать IP сервера.

---

## ЧАСТЬ 3. Первый вход на сервер

```powershell
ssh -i $env:USERPROFILE\.ssh\selectel_vmeste root@ВАШ_IP
```

При первом входе: `yes` на вопрос о fingerprint.

Если ключ не работает — в Selectel откройте **Консоль VNC** и войдите по паролю root.

### Базовая настройка сервера

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2 git ufw

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## ЧАСТЬ 4. Загрузка проекта

### Вариант A — через Git (если репозиторий публичный/доступен)

```bash
git clone https://github.com/AnLoG21/Vmeste.git /opt/vmeste
cd /opt/vmeste
```

### Вариант B — с вашего ПК (если код только локально)

На **Windows** в PowerShell:

```powershell
scp -i $env:USERPROFILE\.ssh\selectel_vmeste -r C:\Users\analo\projects\vmeste\Vmeste root@ВАШ_IP:/opt/vmeste
```

На сервере:

```bash
cd /opt/vmeste
```

---

## ЧАСТЬ 5. Файл `.env` на сервере

```bash
cp .env.production.example .env
nano .env
```

Замените `ваш-домен.ru` на реальный домен. Пример:

```env
DOMAIN=vmeste.ru
VITE_API_URL=https://vmeste.ru/api
DEBUG=0
SECRET_KEY=любая-длинная-случайная-строка-50-символов
ALLOWED_HOSTS=vmeste.ru,www.vmeste.ru
FRONTEND_URL=https://vmeste.ru
POSTGRES_PASSWORD=надёжный-пароль-123
EMAIL_HOST_PASSWORD=ваш-пароль-приложения-gmail
```

Сгенерировать SECRET_KEY:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Сохранить в nano: `Ctrl+O`, Enter, `Ctrl+X`.

---

## ЧАСТЬ 6. Запуск сайта

```bash
cd /opt/vmeste
docker compose -f docker-compose.prod.yml up -d --build
```

Первый запуск **5–15 минут** (сборка образов).

Проверка:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy
```

Caddy сам получит **бесплатный HTTPS** (Let's Encrypt), когда DNS уже указывает на сервер.

Откройте в браузере: **https://ваш-домен.ru**

---

## ЧАСТЬ 7. Админка и проверки

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

| Проверка | URL |
|----------|-----|
| Сайт | https://ваш-домен.ru |
| API | https://ваш-домен.ru/api/users/roles/ |
| Админка | https://ваш-домен.ru/admin/ |
| Почта | `docker compose -f docker-compose.prod.yml exec web python manage.py test_email` |

### ЮKassa (боевой магазин)

Webhook URL:

```
https://ваш-домен.ru/api/subscriptions/webhook/yookassa/
```

Событие: `payment.succeeded`.

---

## ЧАСТЬ 8. Обновление после изменений в коде

```bash
cd /opt/vmeste
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| Не открывается сайт | DNS ещё не обновился; проверьте `ufw` (порты 80, 443) |
| Ошибка HTTPS / Caddy | Домен в `.env` (`DOMAIN`) должен совпадать с DNS |
| 502 Bad Gateway | `docker compose -f docker-compose.prod.yml logs web` |
| Письма не уходят | Пароль приложения Gmail, не обычный пароль |
| API не работает | `VITE_API_URL` должен быть `https://домен/api` до сборки frontend |

---

## Краткий чеклист

- [ ] SSH-ключ создан и добавлен в Selectel
- [ ] Пароль root сохранён
- [ ] Сервер создан, IP записан
- [ ] A-записи домена → IP
- [ ] Docker установлен, порты 80/443 открыты
- [ ] Проект в `/opt/vmeste`
- [ ] `.env` заполнен (DOMAIN, SECRET_KEY, пароли)
- [ ] `docker compose -f docker-compose.prod.yml up -d --build`
- [ ] https://домен открывается
- [ ] createsuperuser, test_email, ЮKassa webhook
