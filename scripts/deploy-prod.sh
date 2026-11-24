#!/usr/bin/env bash
# Fast prod deploy: rebuild only what changed. Frontend Vite runs in GitHub Actions;
# VPS only packs a runtime nginx image (or syncs static HTML). No agents/seeds spam.
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/vmeste}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HUB_MIRROR="${DOCKER_HUB_MIRROR:-dockerhub.timeweb.cloud}"
MIN_FREE_MB="${DEPLOY_MIN_FREE_MB:-700}"

cd "$ROOT"

echo "[deploy] $(date -Is) in $ROOT"

free_kb() { df -Pk / | awk 'NR==2 {print $4}'; }

ensure_disk_space() {
  local free_mb=$(( $(free_kb) / 1024 ))
  echo "[deploy] free on /: ${free_mb} MiB (min ${MIN_FREE_MB})"
  if (( free_mb >= MIN_FREE_MB )); then
    return 0
  fi
  echo "[deploy] low disk — prune dangling only..."
  docker container prune -f >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
  free_mb=$(( $(free_kb) / 1024 ))
  if (( free_mb < MIN_FREE_MB )); then
    echo "[deploy] ERROR: only ${free_mb} MiB free (need ${MIN_FREE_MB})"
    exit 1
  fi
}

ensure_swap() {
  if swapon --show 2>/dev/null | grep -q .; then return 0; fi
  if [[ -f /swapfile ]]; then swapon /swapfile || true; fi
}

protect_edge_from_oom() {
  local cid pid
  for svc in caddy frontend; do
    cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" 2>/dev/null || true)"
    [[ -z "$cid" ]] && continue
    pid="$(docker inspect -f '{{.State.Pid}}' "$cid" 2>/dev/null || true)"
    if [[ -n "$pid" && "$pid" != "0" && -w "/proc/$pid/oom_score_adj" ]]; then
      echo -800 > "/proc/$pid/oom_score_adj" 2>/dev/null || true
    fi
  done
}

ensure_base_image() {
  local image="$1"
  if docker image inspect "$image" >/dev/null 2>&1; then
    return 0
  fi
  echo "[deploy] pulling $image via ${HUB_MIRROR}..."
  docker pull "${HUB_MIRROR}/library/${image}"
  docker tag "${HUB_MIRROR}/library/${image}" "$image"
}

ensure_disk_space
ensure_swap
protect_edge_from_oom

git fetch --prune origin
git checkout main
git reset --hard origin/main

export COMPOSE_PARALLEL_LIMIT=1
export COMPOSE_BAKE=false
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"

BUILD_WEB="${DEPLOY_BUILD_WEB:-false}"
BUILD_FRONTEND="${DEPLOY_BUILD_FRONTEND:-false}"
SYNC_STATIC="${DEPLOY_SYNC_STATIC:-false}"
case "${BUILD_WEB,,}" in true|1|yes) BUILD_WEB=true ;; *) BUILD_WEB=false ;; esac
case "${BUILD_FRONTEND,,}" in true|1|yes) BUILD_FRONTEND=true ;; *) BUILD_FRONTEND=false ;; esac
case "${SYNC_STATIC,,}" in true|1|yes) SYNC_STATIC=true ;; *) SYNC_STATIC=false ;; esac

# Override coarse CI flags by looking at files in this commit — avoids 40m rebuilds
# when only SEO HTML / Caddy / scripts changed (works even with old workflow YAML).
NEEDS_WEB=false
NEEDS_FE_APP=false
ONLY_PUBLIC=true
ONLY_OPS=true
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    backend/*|docker-compose.prod.yml)
      NEEDS_WEB=true; ONLY_PUBLIC=false; ONLY_OPS=false ;;
    frontend/src/*|frontend/package.json|frontend/package-lock.json|frontend/vite.config.js|frontend/index.html|frontend/Dockerfile|frontend/Dockerfile.runtime|frontend/nginx.conf)
      NEEDS_FE_APP=true; ONLY_PUBLIC=false; ONLY_OPS=false ;;
    frontend/public/*)
      ONLY_OPS=false ;;
    Caddyfile|Caddyfile.http-only|scripts/*|.github/*|.seoagent/*|*.md)
      ;;
    *)
      ONLY_PUBLIC=false; ONLY_OPS=false ;;
  esac
done < <(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null || true)

if [[ "$ONLY_OPS" == "true" && "$NEEDS_WEB" == "false" && "$NEEDS_FE_APP" == "false" ]]; then
  echo "[deploy] commit is ops/docs only — skip image rebuilds"
  BUILD_WEB=false
  BUILD_FRONTEND=false
  SYNC_STATIC=false
elif [[ "$NEEDS_FE_APP" == "false" && "$ONLY_PUBLIC" == "true" && "$NEEDS_WEB" == "false" ]]; then
  echo "[deploy] commit is frontend/public only — hot sync, no Vite"
  BUILD_WEB=false
  BUILD_FRONTEND=false
  SYNC_STATIC=true
else
  # Respect CI when app/backend actually changed; never rebuild FE for scripts alone
  if [[ "$NEEDS_WEB" == "false" ]]; then BUILD_WEB=false; fi
  if [[ "$NEEDS_FE_APP" == "false" ]]; then BUILD_FRONTEND=false; fi
  if [[ "$NEEDS_FE_APP" == "false" && "$ONLY_PUBLIC" == "false" && "$SYNC_STATIC" != "true" ]]; then
    : # ops mixed with other non-fe files
  fi
fi
if [[ "$BUILD_FRONTEND" == "true" ]]; then SYNC_STATIC=false; fi

echo "[deploy] BUILD_WEB=${BUILD_WEB} BUILD_FRONTEND=${BUILD_FRONTEND} SYNC_STATIC=${SYNC_STATIC}"

# --- backend ---
if [[ "$BUILD_WEB" == "true" ]]; then
  ensure_base_image python:3.12-slim-bookworm
  docker compose -f "$COMPOSE_FILE" stop celery_worker celery_beat || true
  protect_edge_from_oom
  docker compose -f "$COMPOSE_FILE" build web
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps web
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps celery_worker celery_beat || true
else
  echo "[deploy] skip web rebuild"
fi

# --- frontend: prefer CI artifact; fall back to VPS Vite build if tarball missing ---
if [[ "$BUILD_FRONTEND" == "true" ]]; then
  TGZ="${DEPLOY_FRONTEND_TGZ:-/tmp/frontend-dist.tgz}"
  if [[ -f "$TGZ" ]]; then
    ensure_base_image nginx:1.27-alpine
    STAGE="$(mktemp -d /tmp/fe-runtime.XXXXXX)"
    tar -xzf "$TGZ" -C "$STAGE"
    if [[ ! -d "$STAGE/dist" || ! -f "$STAGE/Dockerfile.runtime" ]]; then
      echo "[deploy] ERROR: bad artifact layout"
      ls -la "$STAGE"
      exit 1
    fi
    FE_IMAGE="$(docker compose -f "$COMPOSE_FILE" config --images frontend | head -1)"
    echo "[deploy] docker build runtime from CI dist → ${FE_IMAGE}"
    docker build -t "$FE_IMAGE" -f "$STAGE/Dockerfile.runtime" "$STAGE"
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps --no-build frontend
    rm -rf "$STAGE" "$TGZ"
    echo "[deploy] frontend runtime up"
  else
    echo "[deploy] WARN: no $TGZ — falling back to VPS frontend docker build (slow)"
    ensure_base_image node:20-alpine
    ensure_base_image nginx:1.27-alpine
    docker compose -f "$COMPOSE_FILE" build frontend
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps frontend
  fi
fi

# --- SEO static HTML hot-copy ---
if [[ "$SYNC_STATIC" == "true" ]]; then
  CID="$(docker compose -f "$COMPOSE_FILE" ps -q frontend || true)"
  if [[ -z "$CID" ]]; then
    echo "[deploy] ERROR: frontend container missing for static sync"
    exit 1
  fi
  echo "[deploy] docker cp frontend/public → container (no rebuild)"
  docker cp frontend/public/. "$CID":/usr/share/nginx/html/
  docker compose -f "$COMPOSE_FILE" exec -T frontend nginx -s reload 2>/dev/null || true
fi

# --- caddy ---
if docker compose -f "$COMPOSE_FILE" ps --status running caddy 2>/dev/null | grep -q caddy; then
  echo "[deploy] reload Caddyfile"
  docker compose -f "$COMPOSE_FILE" exec -T caddy caddy reload --config /etc/caddy/Caddyfile \
    || docker compose -f "$COMPOSE_FILE" up -d --no-deps caddy
else
  docker compose -f "$COMPOSE_FILE" up -d --no-deps caddy
fi
protect_edge_from_oom

if [[ "$BUILD_WEB" == "true" ]]; then
  echo "[deploy] migrate..."
  docker compose -f "$COMPOSE_FILE" exec -T web python manage.py migrate --noinput
else
  echo "[deploy] skip migrate"
fi

if [[ "$BUILD_FRONTEND" == "true" ]]; then
  JS_COUNT="$(docker compose -f "$COMPOSE_FILE" exec -T frontend sh -c 'ls -1 /usr/share/nginx/html/assets/*.js 2>/dev/null | wc -l' | tr -d '[:space:]')"
  test "${JS_COUNT:-0}" -ge 1 || { echo "[deploy] ERROR: no JS assets"; exit 1; }
fi

if [[ "${DEPLOY_SEED:-0}" == "1" && "$BUILD_WEB" == "true" ]]; then
  docker compose -f "$COMPOSE_FILE" exec -T web python manage.py seed_vmagnitol_coolray || true
fi

docker image prune -f >/dev/null 2>&1 || true
echo "[deploy] done"
docker compose -f "$COMPOSE_FILE" ps
