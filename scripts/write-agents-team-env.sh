#!/usr/bin/env bash
# Writes /opt/vmeste/agents-team/.env from environment (used by GitHub Actions deploy).
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/vmeste}"
cd "$ROOT"

if [[ -z "${TELEGRAM_TEAM_BOT_TOKEN:-}" ]]; then
  echo "[agents-env] TELEGRAM_TEAM_BOT_TOKEN empty — skip"
  exit 0
fi

umask 077
mkdir -p agents-team
cat > agents-team/.env <<EOF
TELEGRAM_TEAM_BOT_TOKEN=${TELEGRAM_TEAM_BOT_TOKEN}
TELEGRAM_ALLOWED_USER_IDS=${TELEGRAM_ALLOWED_USER_IDS:-}
TELEGRAM_HTTP_PROXY=${TELEGRAM_HTTP_PROXY:-http://172.18.0.1:10809}
LLM_PROVIDER=${LLM_PROVIDER:-groq}
GEMINI_API_KEY=${GEMINI_API_KEY:-}
GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.0-flash}
MISTRAL_API_KEY=${MISTRAL_API_KEY:-}
MISTRAL_MODEL=${MISTRAL_MODEL:-mistral-small-latest}
GROQ_API_KEY=${GROQ_API_KEY:-}
GROQ_MODEL=${GROQ_MODEL:-openai/gpt-oss-20b}
CURSOR_API_KEY=${CURSOR_API_KEY:-}
CURSOR_RUNTIME=${CURSOR_RUNTIME:-cloud}
CURSOR_REPO_URL=${CURSOR_REPO_URL:-https://github.com/AnLoG21/Vmeste.git}
CURSOR_REPO_REF=${CURSOR_REPO_REF:-main}
CURSOR_MODEL=${CURSOR_MODEL:-composer-2.5}
CURSOR_AUTO_PR=${CURSOR_AUTO_PR:-0}
CURSOR_WORKSPACE=${CURSOR_WORKSPACE:-/opt/vmeste}
DEV_AUTO=${DEV_AUTO:-0}
EOF
chmod 600 agents-team/.env
echo "[agents-env] wrote agents-team/.env ($(wc -c < agents-team/.env) bytes)"
