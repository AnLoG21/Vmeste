#!/usr/bin/env bash
# Prod deploy on VPS: pull main and rebuild all app services (frontend + web).
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/vmeste}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$ROOT"

echo "[deploy] $(date -Is) in $ROOT"

# 1 GB VPS OOMs during parallel docker builds without swap.
if [[ ! -f /swapfile ]]; then
  echo "[deploy] creating 1G swapfile..."
  fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
elif ! swapon --show | grep -q '/swapfile'; then
  swapon /swapfile || true
fi

git fetch --prune origin
git checkout main
git reset --hard origin/main

echo "[deploy] building images sequentially (low RAM)..."
export COMPOSE_PARALLEL_LIMIT=1
docker compose -f "$COMPOSE_FILE" stop celery_worker celery_beat || true
docker builder prune -f >/dev/null 2>&1 || true
docker compose -f "$COMPOSE_FILE" build web
docker compose -f "$COMPOSE_FILE" build frontend
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans web frontend caddy celery_worker celery_beat

echo "[deploy] pruning dangling images (safe)..."
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] done"
docker compose -f "$COMPOSE_FILE" ps
