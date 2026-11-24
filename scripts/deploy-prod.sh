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
  # Always drop dangling layers; aggressive prune only when below threshold.
  docker container prune -f >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
  if (( free_mb >= MIN_FREE_MB )); then
    return 0
  fi
  echo "[deploy] low disk — pruning Docker (images/build-cache; volumes kept)..."
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

# Small VPS OOMs during docker builds without swap — prefer 2G.
ensure_swap() {
  local want_mb=2048
  if swapon --show | grep -q '/swapfile'; then
    return 0
  fi
  if [[ -f /swapfile ]]; then
    swapon /swapfile || true
    return 0
  fi
  free_mb=$(( $(free_kb) / 1024 ))
  if (( free_mb < want_mb + 400 )); then
    echo "[deploy] skip creating ${want_mb}M swapfile (only ${free_mb} MiB free)"
    return 0
  fi
  echo "[deploy] creating ${want_mb}M swapfile..."
  if fallocate -l "${want_mb}M" /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count="$want_mb"; then
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  else
    echo "[deploy] warn: could not create swapfile"
    rm -f /swapfile
  fi
}
ensure_swap

# Prefer OOM-killing build/workers over the public edge (caddy/frontend).
protect_edge_from_oom() {
  local cid
  for svc in caddy frontend; do
    cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" 2>/dev/null || true)"
    if [[ -n "$cid" ]]; then
      docker inspect -f '{{.State.Pid}}' "$cid" 2>/dev/null | while read -r pid; do
        if [[ -n "$pid" && "$pid" != "0" && -r "/proc/$pid/oom_score_adj" ]]; then
          echo -800 > "/proc/$pid/oom_score_adj" 2>/dev/null || true
        fi
      done
    fi
  done
}
protect_edge_from_oom

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
# BuildKit caches layers much faster on repeat frontend deploys.
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"
BUILD_WEB="${DEPLOY_BUILD_WEB:-true}"
BUILD_FRONTEND="${DEPLOY_BUILD_FRONTEND:-true}"
# Normalize GitHub expression booleans / strings
case "${BUILD_WEB,,}" in false|0|no) BUILD_WEB=false ;; *) BUILD_WEB=true ;; esac
case "${BUILD_FRONTEND,,}" in false|0|no) BUILD_FRONTEND=false ;; *) BUILD_FRONTEND=true ;; esac
echo "[deploy] BUILD_WEB=${BUILD_WEB} BUILD_FRONTEND=${BUILD_FRONTEND}"

ensure_base_image python:3.12-slim-bookworm
ensure_base_image node:20-alpine
ensure_base_image nginx:1.27-alpine
docker compose -f "$COMPOSE_FILE" stop celery_worker celery_beat || true
# Free RAM before image builds (agents-team is heavy on small VPS).
docker compose -f "$COMPOSE_FILE" --profile agents stop agents_team 2>/dev/null || true
protect_edge_from_oom
ensure_disk_space

if [[ "$BUILD_WEB" == "true" ]]; then
  docker compose -f "$COMPOSE_FILE" build web
else
  echo "[deploy] skip web image rebuild (no backend changes)"
fi

# Cached frontend rebuild is enough after CI already validated the build.
# Set FRONTEND_NO_CACHE=1 for a clean rebuild when Vite env args change.
ensure_disk_space
if [[ "$BUILD_FRONTEND" == "true" ]]; then
  if [[ "${FRONTEND_NO_CACHE:-0}" == "1" ]]; then
    docker compose -f "$COMPOSE_FILE" build --no-cache frontend
  else
    docker compose -f "$COMPOSE_FILE" build frontend
  fi
else
  echo "[deploy] skip frontend image rebuild (no frontend changes)"
fi

# Recreate only app images we rebuilt. Caddyfile is bind-mounted — reload, do not
# force-recreate (edge blip + Google «проблема со всем сайтом»). Set CADDY_RECREATE=1
# only when the caddy *container* definition itself must change.
APP_SERVICES=()
if [[ "$BUILD_WEB" == "true" ]]; then APP_SERVICES+=(web); fi
if [[ "$BUILD_FRONTEND" == "true" ]]; then APP_SERVICES+=(frontend); fi

protect_edge_from_oom

if ((${#APP_SERVICES[@]})); then
  echo "[deploy] recreate app services: ${APP_SERVICES[*]}"
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps --remove-orphans "${APP_SERVICES[@]}"
else
  echo "[deploy] no app image changes"
fi

# Workers can bounce independently; they are not on the public edge.
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps celery_worker celery_beat || true

case "${CADDY_RECREATE:-0}" in
  1|true|yes|YES)
    echo "[deploy] CADDY_RECREATE=1 — force-recreate caddy"
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps caddy
    ;;
  *)
    if docker compose -f "$COMPOSE_FILE" ps --status running caddy 2>/dev/null | grep -q caddy; then
      echo "[deploy] reload bind-mounted Caddyfile (edge stays up)"
      docker compose -f "$COMPOSE_FILE" exec -T caddy caddy reload --config /etc/caddy/Caddyfile \
        || docker compose -f "$COMPOSE_FILE" up -d --no-deps caddy
    else
      echo "[deploy] caddy not running — start"
      docker compose -f "$COMPOSE_FILE" up -d --no-deps caddy
    fi
    ;;
esac
cat Caddyfile docker-compose.prod.yml 2>/dev/null | sha256sum | awk '{print $1}' > .deploy-caddy-hash || true
protect_edge_from_oom

# Keep tunnel up if the profile/service exists (HTTPS via Cloudflare). Never force-recreate
# unless missing — tunnel reconnect churn looks like site-wide downtime to Googlebot.
if ! docker compose -f "$COMPOSE_FILE" ps --status running cloudflared 2>/dev/null | grep -q cloudflared; then
  echo "[deploy] cloudflared not running — starting"
  docker compose -f "$COMPOSE_FILE" up -d cloudflared 2>/dev/null || true
else
  echo "[deploy] cloudflared already up — leave it"
fi

if [ -f .env ] && grep -qE '^ASTERISK_INTERNAL_SECRET=.+' .env; then
  if [[ "$BUILD_WEB" == "true" ]]; then
    echo "[deploy] Asterisk telephony profile (SIP 5060/udp)…"
    docker compose -f "$COMPOSE_FILE" --profile telephony build asterisk
    docker compose -f "$COMPOSE_FILE" --profile telephony up -d --force-recreate asterisk
  else
    echo "[deploy] skip Asterisk rebuild (no backend changes)"
  fi
else
  echo "[deploy] skip Asterisk (no ASTERISK_INTERNAL_SECRET in .env)"
fi

echo "[deploy] verify frontend assets..."
FE_HTML="$(docker compose -f "$COMPOSE_FILE" exec -T frontend cat /usr/share/nginx/html/index.html)"
JS_COUNT="$(docker compose -f "$COMPOSE_FILE" exec -T frontend sh -c 'ls -1 /usr/share/nginx/html/assets/*.js 2>/dev/null | wc -l' | tr -d '[:space:]')"
echo "$FE_HTML" | grep -q '/assets/index-' || { echo "[deploy] ERROR: index.html has no /assets/index-*.js"; exit 1; }
test "${JS_COUNT:-0}" -ge 2 || { echo "[deploy] ERROR: expected JS assets in /assets, found ${JS_COUNT}"; exit 1; }

# Always migrate — frontend-only rebuilds still need pending apps (e.g. vsayte leads).
echo "[deploy] apply migrations..."
docker compose -f "$COMPOSE_FILE" exec -T web python manage.py migrate --noinput

echo "[deploy] verify critical migrations applied..."
MIGS="$(docker compose -f "$COMPOSE_FILE" exec -T web python manage.py showmigrations booking shop vmagazine vsayte vmagnitol 2>/dev/null || true)"
echo "$MIGS" | sed -n '1,180p'
need_ok() {
  local app="$1" name="$2"
  echo "$MIGS" | grep -E "\[X\][[:space:]]+${name}([[:space:]]|$)" >/dev/null || {
    echo "[deploy] ERROR: missing applied migration ${app}.${name}"
    echo "[deploy] Hint: docker compose -f $COMPOSE_FILE exec web python manage.py migrate --noinput"
    exit 1
  }
}
need_ok booking 0033_messaging_enable_email
need_ok booking 0034_client_migrate_request
need_ok shop 0008_product_weight_dims
need_ok vmagazine 0006_returnrequestphoto
need_ok vsayte 0002_sitelead
need_ok vmagnitol 0001_initial
need_ok vmagnitol 0002_guide_sections_and_safety
echo "[deploy] critical migrations OK"

echo "[deploy] seed Вмагнитоле Coolray starter (idempotent)..."
docker compose -f "$COMPOSE_FILE" exec -T web python manage.py seed_vmagnitol_coolray || true
docker compose -f "$COMPOSE_FILE" exec -T web python manage.py seed_vmagnitol_geely || true
docker compose -f "$COMPOSE_FILE" exec -T web python manage.py seed_vmagnitol_forum || true
docker compose -f "$COMPOSE_FILE" exec -T web python manage.py seed_vmagnitol_detailed || true

echo "[deploy] pruning dangling images (safe)..."
docker image prune -f >/dev/null 2>&1 || true

if [[ -f agents-team/.env ]] && grep -qE '^TELEGRAM_TEAM_BOT_TOKEN=.+' agents-team/.env; then
  echo "[deploy] agents-team bot (host network + Telegram SOCKS)…"
  ensure_base_image node:22-bookworm-slim
  docker compose -f "$COMPOSE_FILE" --profile agents build agents_team
  docker compose -f "$COMPOSE_FILE" --profile agents up -d --force-recreate agents_team
  docker compose -f "$COMPOSE_FILE" --profile agents logs --tail=40 agents_team || true
else
  echo "[deploy] skip agents-team (no agents-team/.env with TELEGRAM_TEAM_BOT_TOKEN)"
fi

echo "[deploy] done"
df -h / || true
docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" --profile agents ps 2>/dev/null || true
