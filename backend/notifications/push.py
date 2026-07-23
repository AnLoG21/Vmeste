"""Firebase Cloud Messaging HTTP v1 sender (service account)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from functools import lru_cache
from pathlib import Path

from django.conf import settings

from .models import DevicePushToken, InAppNotification

logger = logging.getLogger(__name__)


def _credentials_path() -> str:
    explicit = (getattr(settings, "FIREBASE_CREDENTIALS", "") or "").strip()
    if explicit:
        return explicit
    # Common default path inside the web container / repo
    for candidate in (
        Path(settings.BASE_DIR) / "firebase-service-account.json",
        Path("/app/firebase-service-account.json"),
    ):
        if candidate.is_file():
            return str(candidate)
    return ""


@lru_cache(maxsize=1)
def _service_account():
    path = _credentials_path()
    if not path or not Path(path).is_file():
        return None
    try:
        from google.oauth2 import service_account
    except ImportError:
        logger.error("google-auth is not installed; cannot send FCM v1 pushes")
        return None
    scopes = ["https://www.googleapis.com/auth/firebase.messaging"]
    return service_account.Credentials.from_service_account_file(path, scopes=scopes)


def _project_id() -> str:
    env_id = (getattr(settings, "FIREBASE_PROJECT_ID", "") or "").strip()
    if env_id:
        return env_id
    creds = _service_account()
    if creds is None:
        return ""
    return getattr(creds, "project_id", "") or ""


def _access_token() -> str | None:
    creds = _service_account()
    if creds is None:
        return None
    from google.auth.transport.requests import Request

    creds.refresh(Request())
    return creds.token


def send_fcm_to_tokens(tokens: list[str], *, title: str, body: str, data: dict | None = None) -> int:
    """Send via FCM HTTP v1. Returns number of successful sends."""
    project_id = _project_id()
    token_auth = _access_token()
    if not project_id or not token_auth or not tokens:
        if tokens and not token_auth:
            logger.warning("FCM v1 not configured (FIREBASE_CREDENTIALS / service account missing)")
        return 0

    ok = 0
    payload_data = {str(k): str(v) for k, v in (data or {}).items()}
    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"

    for device_token in tokens:
        message = {
            "message": {
                "token": device_token,
                "notification": {"title": title[:120], "body": body[:240]},
                "data": payload_data,
                "android": {"priority": "HIGH"},
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(message).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token_auth}",
                "Content-Type": "application/json; charset=UTF-8",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp.read()
            ok += 1
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            logger.error("FCM v1 HTTP %s: %s", e.code, err_body[:500])
            # Drop invalid / unregistered tokens
            if e.code in (404, 400) and any(
                x in err_body for x in ("UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND", "registration-token-not-registered")
            ):
                DevicePushToken.objects.filter(token=device_token).delete()
            # Refresh token once on 401
            if e.code == 401:
                _service_account.cache_clear()
                token_auth = _access_token() or token_auth
        except Exception:
            logger.exception("FCM v1 send failed")
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
    tokens = list(DevicePushToken.objects.filter(user_id__in=ids).values_list("token", flat=True))
    send_fcm_to_tokens(tokens, title=title, body=body, data={"kind": kind, **payload})
