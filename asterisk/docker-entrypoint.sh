#!/bin/sh
set -eu

mkdir -p /etc/asterisk/generated
if [ -d /etc/asterisk/base ]; then
  cp -f /etc/asterisk/base/*.conf /etc/asterisk/ 2>/dev/null || true
fi
if [ -f /etc/asterisk/generated/pjsip_trunks.conf ]; then
  grep -q 'pjsip_trunks.conf' /etc/asterisk/pjsip.conf 2>/dev/null || \
    echo '#include pjsip_trunks.conf' >> /etc/asterisk/pjsip.conf
  ln -sf /etc/asterisk/generated/pjsip_trunks.conf /etc/asterisk/pjsip_trunks.conf
fi
if [ -f /etc/asterisk/generated/extensions_vmeste.conf ]; then
  grep -q 'extensions_vmeste.conf' /etc/asterisk/extensions.conf 2>/dev/null || \
    echo '#include extensions_vmeste.conf' >> /etc/asterisk/extensions.conf
  ln -sf /etc/asterisk/generated/extensions_vmeste.conf /etc/asterisk/extensions_vmeste.conf
fi

if [ -f /etc/asterisk/manager.conf ]; then
  AMI_SECRET="${ASTERISK_AMI_SECRET:-${ASTERISK_INTERNAL_SECRET:-}}"
  if [ -n "$AMI_SECRET" ]; then
    sed -i "s/CHANGE_ME/${AMI_SECRET}/g" /etc/asterisk/manager.conf
  fi
fi

# Cap on-disk Asterisk logs (messages.log / queue_log previously grew to 10G+).
LOGDIR="${ASTERISK_LOG_DIR:-/var/log/asterisk}"
MAX_BYTES="${ASTERISK_LOG_MAX_BYTES:-52428800}" # 50 MiB per file
mkdir -p "$LOGDIR"
for f in messages messages.log queue_log full full.log security security.log; do
  path="$LOGDIR/$f"
  if [ -f "$path" ]; then
    size=$(wc -c < "$path" 2>/dev/null || echo 0)
    if [ "${size:-0}" -gt "$MAX_BYTES" ]; then
      echo "[asterisk] truncating oversized log $path (${size} bytes)"
      : > "$path"
    fi
  fi
done

exec "$@"
