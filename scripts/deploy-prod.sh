#!/usr/bin/env bash
# Prod deploy on VPS: pull main and rebuild all app services (frontend + web).
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/vmeste}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
# Selectel/RU VPS often times out on Docker Hub IPv6; Timeweb mirror is IPv4.
HUB_MIRROR="${DOCKER_HUB_MIRROR:-dockerhub.timeweb.cloud}"
# Fail early if free space on / is below this many MiB (builds need headroom).
MIN_FREE_MB="${DEPLOY_MIN_FREE_MB:-900}"

cd "$ROOT"

echo "[deploy] $(date -Is) in $ROOT"
df -h / || true
docker system df 2>/dev/null || true

free_kb() {
  df -Pk / | awk 'NR==2 {print $4}'
}

ensure_disk_space() {
  local free_mb=$(( $(free_kb) / 1024 ))
  echo "[deploy] free on /: ${free_mb} MiB (min ${MIN_FREE_MB})"
  if (( free_mb >= MIN_FREE_MB )); then
    return 0
  fi
  echo "[deploy] low disk — pruning Docker (images/build-cache; volumes kept)..."
  docker container prune -f >/dev/null 2>&1 || true
  docker image prune -af >/dev/null 2>&1 || true
  docker builder prune -af >/dev/null 2>&1 || true
  docker buildx prune -af >/dev/null 2>&1 || true
  journalctl --vacuum-size=50M >/dev/null 2>&1 || true
  free_mb=$(( $(free_kb) / 1024 ))
  echo "[deploy] free after prune: ${free_mb} MiB"
  if (( free_mb < MIN_FREE_MB )); then
    echo "[deploy] ERROR: still only ${free_mb} MiB free (need ${MIN_FREE_MB})."
    echo "[deploy] Run: chmod +x scripts/free-disk.sh && ./scripts/free-disk.sh"
    echo "[deploy] Then check: du -xh /var/lib/docker | sort -h | tail -20"
    exit 1
  fi
}

# Free space before swap/build — fallocate of a 1G swapfile makes a full disk worse.
ensure_disk_space

# 1 GB VPS OOMs during parallel docker builds without swap.
if [[ ! -f /swapfile ]]; then
  free_mb=$(( $(free_kb) / 1024 ))
  if (( free_mb < 1200 )); then
    echo "[deploy] skip creating swapfile (only ${free_mb} MiB free)"
  else
    echo "[deploy] creating 1G swapfile..."
    if fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024; then
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    else
      echo "[deploy] warn: could not create swapfile"
      rm -f /swapfile
    fi
  fi
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
ensure_disk_space
docker compose -f "$COMPOSE_FILE" build web
# Cached frontend rebuild is enough after CI already validated the build.
# Set FRONTEND_NO_CACHE=1 for a clean rebuild when Vite env args change.
ensure_disk_space
if [[ "${FRONTEND_NO_CACHE:-0}" == "1" ]]; then
  docker compose -f "$COMPOSE_FILE" build --no-cache frontend
else
  docker compose -f "$COMPOSE_FILE" build frontend
fi
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans web frontend caddy celery_worker celery_beat
# Keep tunnel up if the profile/service exists (HTTPS via Cloudflare).
docker compose -f "$COMPOSE_FILE" up -d cloudflared 2>/dev/null || true

if [ -f .env ] && grep -qE '^ASTERISK_INTERNAL_SECRET=.+' .env; then
  echo "[deploy] Asterisk telephony profile (SIP 5060/udp)…"
  docker compose -f "$COMPOSE_FILE" --profile telephony build asterisk
  docker compose -f "$COMPOSE_FILE" --profile telephony up -d --force-recreate asterisk
else
  echo "[deploy] skip Asterisk (no ASTERISK_INTERNAL_SECRET in .env)"
fi

echo "[deploy] verify frontend assets..."
FE_HTML="$(docker compose -f "$COMPOSE_FILE" exec -T frontend cat /usr/share/nginx/html/index.html)"
JS_COUNT="$(docker compose -f "$COMPOSE_FILE" exec -T frontend sh -c 'ls -1 /usr/share/nginx/html/assets/*.js 2>/dev/null | wc -l' | tr -d '[:space:]')"
echo "$FE_HTML" | grep -q '/assets/index-' || { echo "[deploy] ERROR: index.html has no /assets/index-*.js"; exit 1; }
test "${JS_COUNT:-0}" -ge 2 || { echo "[deploy] ERROR: expected JS assets in /assets, found ${JS_COUNT}"; exit 1; }

echo "[deploy] pruning dangling images (safe)..."
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] done"
df -h / || true
docker compose -f "$COMPOSE_FILE" ps
