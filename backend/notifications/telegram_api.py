"""Telegram Bot API client (proxy / custom base for RU VPS)."""

from __future__ import annotations

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _api_base() -> str:
    return (getattr(settings, "TELEGRAM_API_BASE", None) or "https://api.telegram.org").rstrip("/")


def _proxies() -> dict | None:
    proxy = (getattr(settings, "TELEGRAM_HTTP_PROXY", None) or "").strip()
    if not proxy:
        return None
    return {"http": proxy, "https": proxy}


def telegram_get(*, token: str, method: str, params: dict | None = None) -> dict | None:
    token = (token or "").strip()
    if not token:
        return None
    url = f"{_api_base()}/bot{token}/{method}"
    try:
        resp = requests.get(url, params=params or {}, timeout=(10, 30), proxies=_proxies())
        data = resp.json() if resp.content else {}
        if not resp.ok or not data.get("ok"):
            logger.error("Telegram API GET %s HTTP %s: %s", method, resp.status_code, str(data)[:500])
            return data if isinstance(data, dict) else None
        return data
    except Exception as exc:
        logger.exception("Telegram API GET %s failed: %s", method, exc)
        return None


def telegram_post(*, token: str, method: str, payload: dict) -> dict | None:
    token = (token or "").strip()
    if not token:
        return None
    url = f"{_api_base()}/bot{token}/{method}"
    try:
        resp = requests.post(url, json=payload, timeout=(10, 30), proxies=_proxies())
        data = resp.json() if resp.content else {}
        if not resp.ok or not data.get("ok"):
            logger.error("Telegram API %s HTTP %s: %s", method, resp.status_code, str(data)[:500])
            return data if isinstance(data, dict) else None
        return data
    except Exception as exc:
        logger.exception("Telegram API %s failed: %s", method, exc)
        return None


def set_webhook(*, token: str, webhook_url: str) -> dict | None:
    return telegram_post(
        token=token,
        method="setWebhook",
        payload={
            "url": webhook_url,
            "allowed_updates": ["message", "edited_message"],
        },
    )


def get_webhook_info(*, token: str) -> dict | None:
    return telegram_get(token=token, method="getWebhookInfo")


def delete_webhook(*, token: str) -> dict | None:
    return telegram_post(token=token, method="deleteWebhook", payload={"drop_pending_updates": False})


def get_updates(*, token: str, offset: int | None = None, timeout: int = 0) -> dict | None:
    payload: dict = {"timeout": timeout, "allowed_updates": ["message", "edited_message"]}
    if offset is not None:
        payload["offset"] = offset
    return telegram_post(token=token, method="getUpdates", payload=payload)
