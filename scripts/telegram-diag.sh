#!/usr/bin/env bash
set -euo pipefail
cd /opt/vmeste
TOKEN=$(sed -n 's/^TELEGRAM_BOT_TOKEN=//p' .env | tr -d '\r')
echo "token_len=${#TOKEN}"
echo "=== getWebhookInfo ==="
curl -sS --max-time 20 "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" || echo "curl_failed"
echo
echo "=== getMe ==="
curl -sS --max-time 20 "https://api.telegram.org/bot${TOKEN}/getMe" || echo "curl_failed"
echo
echo "=== webhook POST test ==="
printf '%s' '{"update_id":1,"message":{"message_id":1,"chat":{"id":999888777},"text":"/chatid"}}' > /tmp/tg_test.json
curl -sS --max-time 20 -X POST https://vsevmeste.space/api/notifications/telegram/webhook/ \
  -H 'Content-Type: application/json' --data-binary @/tmp/tg_test.json || echo "curl_failed"
echo
echo "=== container outbound test ==="
docker compose -f docker-compose.prod.yml exec -T web python manage.py shell -c "
import socket
print('dns', socket.getaddrinfo('api.telegram.org', 443)[0][4][0])
import urllib.request
try:
    urllib.request.urlopen('https://api.telegram.org/', timeout=10)
    print('outbound_ok')
except Exception as e:
    print('outbound_fail', e)
"
