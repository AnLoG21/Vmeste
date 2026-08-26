"""Ops alerts for deploy / SpeechKit / Asterisk failures (SaaS reliability)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


def alert_ops(event: str, detail: str = "", *, extra: dict | None = None) -> None:
    """
    Log a structured ops signal and optionally POST to OPS_ALERT_WEBHOOK_URL
    (Telegram bot webhook, Slack incoming webhook, etc.).
    """
    payload = {
        "source": "vmeste",
        "event": (event or "ops")[:120],
        "detail": (detail or "")[:800],
        "extra": extra or {},
    }
    logger.error("OPS_ALERT event=%s detail=%s", payload["event"], payload["detail"])
    url = (getattr(settings, "OPS_ALERT_WEBHOOK_URL", "") or "").strip()
    if not url:
        return
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            resp.read(200)
    except Exception:
        logger.exception("OPS_ALERT webhook failed event=%s", payload["event"])
