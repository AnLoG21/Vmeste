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

exec "$@"
