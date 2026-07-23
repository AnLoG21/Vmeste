import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

from .models import DevicePushToken, InAppNotification

logger = logging.getLogger(__name__)


def _fcm_server_key() -> str:
    return (getattr(settings, "FCM_SERVER_KEY", "") or "").strip()


def send_fcm_to_tokens(tokens: list[str], *, title: str, body: str, data: dict | None = None) -> int:
    """Send via FCM legacy HTTP API. Returns number of successful sends."""
    key = _fcm_server_key()
    if not key or not tokens:
        return 0
    ok = 0
    payload_data = {str(k): str(v) for k, v in (data or {}).items()}
    for token in tokens:
        req_body = {
            "to": token,
            "notification": {"title": title[:120], "body": body[:240]},
            "data": payload_data,
            "priority": "high",
        }
        req = urllib.request.Request(
            "https://fcm.googleapis.com/fcm/send",
            data=json.dumps(req_body).encode("utf-8"),
            headers={
                "Authorization": f"key={key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            if result.get("failure"):
                # Drop invalid tokens
                results = result.get("results") or []
                if results and results[0].get("error") in {
                    "NotRegistered",
                    "InvalidRegistration",
                }:
                    DevicePushToken.objects.filter(token=token).delete()
                logger.warning("FCM failure for token …%s: %s", token[-8:], results)
            else:
                ok += 1
        except urllib.error.HTTPError as e:
            body_txt = e.read().decode("utf-8", errors="replace")
            logger.error("FCM HTTP %s: %s", e.code, body_txt[:500])
        except Exception:
            logger.exception("FCM send failed")
    return ok


def notify_users(user_ids, *, kind: str, title: str, body: str, payload: dict | None = None):
    """Create in-app rows and push to registered devices."""
    ids = list({int(x) for x in user_ids if x})
    if not ids:
        return
    payload = payload or {}
    rows = [
        InAppNotification(user_id=uid, kind=kind, payload={**payload, "title": title, "body": body})
        for uid in ids
    ]
    InAppNotification.objects.bulk_create(rows)
    tokens = list(
        DevicePushToken.objects.filter(user_id__in=ids).values_list("token", flat=True)
    )
    send_fcm_to_tokens(tokens, title=title, body=body, data={"kind": kind, **payload})
