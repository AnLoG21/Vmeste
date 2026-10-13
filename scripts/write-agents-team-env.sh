#!/usr/bin/env bash
# Writes /opt/vmeste/agents-team/.env from environment (used by GitHub Actions deploy).
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/vmeste}"
cd "$ROOT"

if [[ -z "${TELEGRAM_TEAM_BOT_TOKEN:-}" ]]; then
  echo "[agents-env] TELEGRAM_TEAM_BOT_TOKEN empty — skip"
  exit 0
fi

# Bridge: older workflows only forward TELEGRAM_ALLOWED_USER_IDS (not GROQ_*).
# Multiline secret format:
#   123456789
#   GROQ:gsk_...
#   MISTRAL:mstrl_...
#   LLM:cursor
ALLOWED_RAW="${TELEGRAM_ALLOWED_USER_IDS:-}"
ALLOWED_IDS=""
BRIDGE_GROQ=""
BRIDGE_MISTRAL=""
BRIDGE_LLM=""
if [[ "$ALLOWED_RAW" == *$'\n'* ]] || [[ "$ALLOWED_RAW" == GROQ:* ]] || [[ "$ALLOWED_RAW" == *"GROQ:"* ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" ]] && continue
    case "$line" in
      GROQ:*) BRIDGE_GROQ="${line#GROQ:}" ;;
      MISTRAL:*) BRIDGE_MISTRAL="${line#MISTRAL:}" ;;
      LLM:*) BRIDGE_LLM="${line#LLM:}" ;;
      *)
        if [[ -z "$ALLOWED_IDS" ]]; then
          ALLOWED_IDS="$line"
        else
          ALLOWED_IDS="${ALLOWED_IDS},${line}"
        fi
        ;;
    esac
  done <<< "$ALLOWED_RAW"
  TELEGRAM_ALLOWED_USER_IDS="$ALLOWED_IDS"
fi

GROQ_API_KEY="${GROQ_API_KEY:-${BRIDGE_GROQ:-}}"
MISTRAL_API_KEY="${MISTRAL_API_KEY:-${BRIDGE_MISTRAL:-}}"
# Prefer Cursor brain when API key exists (Telegram chat resume + repo).
# Explicit LLM_PROVIDER / bridge LLM:* still wins if already set.
if [[ -z "${LLM_PROVIDER:-}" ]]; then
  if [[ -n "${CURSOR_API_KEY:-}" ]]; then
    LLM_PROVIDER=cursor
  else
    LLM_PROVIDER="${BRIDGE_LLM:-groq}"
  fi
fi

umask 077
mkdir -p agents-team
cat > agents-team/.env <<EOF
TELEGRAM_TEAM_BOT_TOKEN=${TELEGRAM_TEAM_BOT_TOKEN}
TELEGRAM_ALLOWED_USER_IDS=${TELEGRAM_ALLOWED_USER_IDS:-}
TELEGRAM_HTTP_PROXY=${TELEGRAM_HTTP_PROXY:-http://172.18.0.1:10809}
# Same proxy for Cursor SDK / Node fetch (region blocks on Selectel/RU IPs)
HTTPS_PROXY=${TELEGRAM_HTTP_PROXY:-http://172.18.0.1:10809}
HTTP_PROXY=${TELEGRAM_HTTP_PROXY:-http://172.18.0.1:10809}
NODE_USE_ENV_PROXY=1
LLM_PROVIDER=${LLM_PROVIDER}
GEMINI_API_KEY=${GEMINI_API_KEY:-}
GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.0-flash}
MISTRAL_API_KEY=${MISTRAL_API_KEY}
MISTRAL_MODEL=${MISTRAL_MODEL:-mistral-small-latest}
GROQ_API_KEY=${GROQ_API_KEY}
GROQ_MODEL=${GROQ_MODEL:-openai/gpt-oss-20b}
CURSOR_API_KEY=${CURSOR_API_KEY:-}
CURSOR_RUNTIME=${CURSOR_RUNTIME:-cloud}
CURSOR_REPO_URL=${CURSOR_REPO_URL:-https://github.com/AnLoG21/Vmeste.git}
CURSOR_REPO_REF=${CURSOR_REPO_REF:-main}
CURSOR_MODEL=${CURSOR_MODEL:-composer-2.5}
CURSOR_AUTO_PR=${CURSOR_AUTO_PR:-0}
CURSOR_WORKSPACE=${CURSOR_WORKSPACE:-/opt/vmeste}
DEV_AUTO=${DEV_AUTO:-1}
LLM_MAX_CONCURRENT=${LLM_MAX_CONCURRENT:-1}
LLM_RATE_LIMIT_RETRIES=${LLM_RATE_LIMIT_RETRIES:-8}
EOF
chmod 600 agents-team/.env
echo "[agents-env] wrote agents-team/.env (provider=${LLM_PROVIDER}, groq=$([ -n "$GROQ_API_KEY" ] && echo set || echo missing), $(wc -c < agents-team/.env) bytes)"
