#!/usr/bin/env bash
# Daily Postgres backup for production VPS. Run via cron, e.g.:
# 0 3 * * * /opt/vmeste/scripts/backup-postgres.sh >> /var/log/vmeste-backup.log 2>&1
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/vmeste}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/vmeste/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

cd "$ROOT"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/vmeste-${STAMP}.sql.gz"

echo "[backup] $(date -Is) dumping to $OUT"
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "${POSTGRES_USER:-vmeste_user}" "${POSTGRES_DB:-vmeste}" | gzip -9 > "$OUT"

find "$BACKUP_DIR" -name 'vmeste-*.sql.gz' -mtime +"$KEEP_DAYS" -delete || true
echo "[backup] done $(du -h "$OUT" | awk '{print $1}')"
