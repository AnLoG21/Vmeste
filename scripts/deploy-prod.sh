#!/usr/bin/env bash
# Prod deploy on VPS: pull main and rebuild all app services (frontend + web).
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/vmeste}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$ROOT"

echo "[deploy] $(date -Is) in $ROOT"
git fetch --prune origin
git checkout main
git reset --hard origin/main

echo "[deploy] building and starting services..."
            docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans web frontend caddy celery_worker celery_beat

echo "[deploy] pruning dangling images (safe)..."
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] done"
docker compose -f "$COMPOSE_FILE" ps
