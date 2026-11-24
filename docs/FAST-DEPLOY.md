# Ускорение деплоя (<10 мин)

Сейчас на VPS уже работают эвристики в `scripts/deploy-prod.sh`: правки только HTML → hot-sync за ~1 мин; без agents/seeds на каждый push.

Полный ускоритель (Vite в GitHub Actions, на VPS только nginx-образ) готов в `scripts/ci/` — его нужно один раз положить в `.github/workflows/` (нужен OAuth scope `workflow`).

## Что сделать вам (по шагам)

### 1. Выдать GitHub CLI право править Actions

В терминале на своём ПК:

```bash
gh auth refresh -h github.com -s workflow,repo
```

Откроется браузер / device code — подтвердите доступ **Workflow** (Update GitHub Action Workflow files).

Проверка:

```bash
gh auth status
# в scopes должно быть: workflow
```

### 2. Скопировать готовые workflow в репозиторий

Из корня `vmeste`:

```bash
copy scripts\ci\deploy.production.yml .github\workflows\deploy.yml
copy scripts\ci\deploy-agents-team.yml .github\workflows\deploy-agents-team.yml
git add .github/workflows/deploy.yml .github/workflows/deploy-agents-team.yml
git commit -m "Use CI-built frontend dist for fast production deploys"
git push origin main
```

(На macOS/Linux: `cp` вместо `copy`.)

### 3. Что изменится после этого

| Тип изменений | Было | Станет |
|---|---|---|
| Только `frontend/public/**` (SEO HTML) | часто полный Vite на VPS | hot-sync / без FE gate |
| `frontend/src/**` | Vite на слабом VPS 20–40 мин | сборка на GitHub (~2–4 мин) + runtime image на VPS (~1 мин) |
| Только `.seoagent` / docs | иногда лишний deploy | deploy можно пропустить |
| `agents-team` | цеплялся к правкам deploy-скриптов | только при изменении `agents-team/**` |

### 4. Не обязательно, но полезно

- Не пушить мелкие коммиты пачками во время длинного backend-build — concurrency отменяет предыдущий run.
- Backend (`backend/**`) всё ещё собирается на VPS — это нормально реже; узкое место было Vite.

## Если `gh auth refresh` снова завис

1. Закройте старый device-login.
2. Повторите команду.
3. На странице GitHub нажмите разрешение **Workflow**, затем **Authorize**.
4. Если кнопка Authorize серая — войдите в аккаунт AnLoG21 и подтвердите sudo/password, если GitHub спросит.
