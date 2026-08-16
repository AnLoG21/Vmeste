# Автодеплой на VPS (GitHub Actions)

После каждого push в `main` (и вручную через Actions → Deploy production) сервер:

1. `git reset --hard origin/main`
2. пересобирает **web + frontend + caddy** (`scripts/deploy-prod.sh`)

Так UI больше не «забывается», если обновили только бэкенд.

## Разовая настройка (5–10 минут)

### 1. SSH-ключ только для деплоя

На своём ПК или на VPS:

```bash
ssh-keygen -t ed25519 -C "vmeste-github-deploy" -f vmeste_deploy -N ""
```

На **VPS** добавьте публичный ключ:

```bash
mkdir -p ~/.ssh
cat >> ~/.ssh/authorized_keys <<'EOF'
# содержимое vmeste_deploy.pub
EOF
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Приватный ключ (`vmeste_deploy` без `.pub`) — в GitHub Secrets (ниже). Не коммитьте его в репозиторий.

### 2. Secrets в GitHub

Репозиторий → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Пример | Описание |
|--------|--------|----------|
| `VPS_HOST` | `1.2.3.4` или `vsevmeste.space` | IP или хост VPS |
| `VPS_USER` | `root` | SSH-пользователь |
| `VPS_SSH_KEY` | весь текст `-----BEGIN OPENSSH PRIVATE KEY-----` … | Приватный ключ |
| `VPS_PORT` | `22` | Опционально, по умолчанию 22 |

### 3. Репозиторий на сервере

Убедитесь, что код лежит в `/opt/vmeste` и remote указывает на GitHub:

```bash
cd /opt/vmeste
git remote -v
git status
```

Пользователь из `VPS_USER` должен уметь писать в `/opt/vmeste` и запускать Docker:

```bash
# если деплой не от root:
sudo usermod -aG docker "$USER"
```

### 4. Проверка

1. Закоммитьте workflow (уже в репозитории: `.github/workflows/deploy.yml`).
2. GitHub → **Actions** → **Deploy production** → **Run workflow**.
3. Через 3–10 минут откройте https://vsevmeste.space/businesses — должна быть новая страница с шапкой (не белый legal-макет).
4. Hard-refresh: `Ctrl+F5`.

## Ручной деплой (если Actions ещё не настроен)

```bash
cd /opt/vmeste
git pull
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh
```

или:

```bash
docker compose -f docker-compose.prod.yml up -d --build frontend web caddy
```

## Если пайплайн падает

- **Permission denied (publickey)** — неверный `VPS_SSH_KEY` / ключ не в `authorized_keys`.
- **Permission denied docker** — пользователь не в группе `docker`.
- **Disk full** — `docker system df`, затем `docker image prune -a` (осторожно).
- Логи Actions: вкладка failed job → Deploy over SSH.
