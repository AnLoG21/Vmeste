"""Outbound channel adapters for booking notifications."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)


def _post_json(url: str, payload: dict, headers: dict | None = None, timeout: int = 20) -> dict | None:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("HTTP %s %s: %s", e.code, url, body[:500])
        return None
    except Exception as e:
        logger.exception("Request failed %s: %s", url, e)
        return None


def send_telegram(*, bot_token: str, chat_id: str, text: str) -> bool:
    token = (bot_token or "").strip()
    cid = (chat_id or "").strip()
    if not token or not cid or not text:
        return False
    from .telegram_api import telegram_post

    data = telegram_post(
        token=token,
        method="sendMessage",
        payload={"chat_id": cid, "text": text[:4000], "disable_web_page_preview": True},
    )
    return bool(data and data.get("ok"))


def send_max(*, bot_token: str, chat_id: str, text: str) -> bool:
    token = (bot_token or "").strip()
    cid = (chat_id or "").strip()
    if not token or not cid or not text:
        return False
    # MAX Bot API (platform-api.max.ru)
    url = "https://platform-api.max.ru/messages"
    payload = {
        "chat_id": int(cid) if str(cid).lstrip("-").isdigit() else cid,
        "text": text[:4000],
    }
    data = _post_json(url, payload, headers={"Authorization": token})
    return data is not None


def send_whatsapp_greenapi(
    *,
    api_url: str,
    id_instance: str,
    api_token: str,
    phone: str,
    text: str,
) -> bool:
    base = (api_url or "https://api.green-api.com").rstrip("/")
    iid = (id_instance or "").strip()
    token = (api_token or "").strip()
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if not iid or not token or not digits or not text:
        return False
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    chat_id = f"{digits}@c.us"
    url = f"{base}/waInstance{iid}/sendMessage/{token}"
    data = _post_json(url, {"chatId": chat_id, "message": text[:4000]})
    return bool(data and (data.get("idMessage") or data.get("message") or data.get("status")))


def send_sms_ru(*, api_id: str, phone: str, text: str) -> tuple[bool, str]:
    """Returns (ok, status_string)."""
    api = (api_id or "").strip()
    digits = "".join(c for c in (phone or "") if c.isdigit() or c == "+")
    if not api or not digits or not text:
        return False, "missing"
    params = urllib.parse.urlencode(
        {
            "api_id": api,
            "to": digits,
            "msg": text[:70] if False else text[:670],
            "json": 1,
        }
    )
    url = f"https://sms.ru/sms/send?{params}"
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        status = str(data.get("status") or "")
        ok = status == "OK" or data.get("status_code") == 100
        return ok, status or ("ok" if ok else "error")
    except Exception as e:
        logger.exception("SMS.ru failed: %s", e)
        return False, "error"
