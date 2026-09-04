#!/usr/bin/env bash
# One-shot disk recovery for low-RAM/low-disk VPS (safe for named app volumes).
set -euo pipefail

echo "[free-disk] $(date -Is)"
echo "[free-disk] before:"
df -h / /var/lib/docker 2>/dev/null || df -h /
docker system df 2>/dev/null || true

echo "[free-disk] pruning Docker (containers/images/build-cache; NOT volumes)..."
docker container prune -f >/dev/null 2>&1 || true
docker image prune -af >/dev/null 2>&1 || true
docker builder prune -af >/dev/null 2>&1 || true
# BuildKit cache can linger separately on some installs.
docker buildx prune -af >/dev/null 2>&1 || true

echo "[free-disk] trimming journals / apt (if present)..."
journalctl --vacuum-size=50M >/dev/null 2>&1 || true
apt-get clean >/dev/null 2>&1 || true
rm -rf /var/cache/apt/archives/*.deb 2>/dev/null || true

# Old docker logs from long-running containers.
if [[ -d /var/lib/docker/containers ]]; then
  find /var/lib/docker/containers -name '*-json.log' -size +50M -print -exec truncate -s 0 {} \; 2>/dev/null || true
fi

echo "[free-disk] after:"
df -h / /var/lib/docker 2>/dev/null || df -h /
docker system df 2>/dev/null || true
echo "[free-disk] done — then: cd /opt/vmeste && ./scripts/deploy-prod.sh"
