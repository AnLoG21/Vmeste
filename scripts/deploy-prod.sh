#!/usr/bin/env bash
# Prod deploy on VPS: pull main and rebuild all app services (frontend + web).
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/vmeste}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
# Selectel/RU VPS often times out on Docker Hub IPv6; Timeweb mirror is IPv4.
HUB_MIRROR="${DOCKER_HUB_MIRROR:-dockerhub.timeweb.cloud}"

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

ensure_base_image() {
  local image="$1"
  if docker image inspect "$image" >/dev/null 2>&1; then
    return 0
  fi
  echo "[deploy] pulling $image via ${HUB_MIRROR}..."
  docker pull "${HUB_MIRROR}/library/${image}"
  docker tag "${HUB_MIRROR}/library/${image}" "$image"
}

echo "[deploy] building images sequentially (low RAM)..."
export COMPOSE_PARALLEL_LIMIT=1
# Bake talks to registry-1.docker.io for FROM metadata even when layers exist.
export COMPOSE_BAKE=false
export DOCKER_BUILDKIT=0
ensure_base_image python:3.12-slim-bookworm
ensure_base_image node:20-alpine
ensure_base_image nginx:1.27-alpine
docker compose -f "$COMPOSE_FILE" stop celery_worker celery_beat || true
docker compose -f "$COMPOSE_FILE" build web
docker compose -f "$COMPOSE_FILE" build --no-cache frontend
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans web frontend caddy celery_worker celery_beat

echo "[deploy] verify frontend assets..."
FE_HTML="$(docker compose -f "$COMPOSE_FILE" exec -T frontend cat /usr/share/nginx/html/index.html)"
JS_COUNT="$(docker compose -f "$COMPOSE_FILE" exec -T frontend sh -c 'ls -1 /usr/share/nginx/html/assets/*.js 2>/dev/null | wc -l' | tr -d '[:space:]')"
echo "$FE_HTML" | grep -q '/assets/index-' || { echo "[deploy] ERROR: index.html has no /assets/index-*.js"; exit 1; }
test "${JS_COUNT:-0}" -ge 2 || { echo "[deploy] ERROR: expected JS assets in /assets, found ${JS_COUNT}"; exit 1; }

echo "[deploy] pruning dangling images (safe)..."
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] done"
docker compose -f "$COMPOSE_FILE" ps
