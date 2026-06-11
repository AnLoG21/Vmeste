import base64
import json
import logging
import uuid
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


def _configured() -> bool:
    return bool(settings.YOOKASSA_SHOP_ID and settings.YOOKASSA_SECRET_KEY)


def create_payment(*, amount: str, description: str, return_url: str, metadata: dict) -> dict | None:
    if not _configured():
        return None
    auth = base64.b64encode(
        f"{settings.YOOKASSA_SHOP_ID}:{settings.YOOKASSA_SECRET_KEY}".encode()
    ).decode()
    payload = {
        "amount": {"value": f"{float(amount):.2f}", "currency": "RUB"},
        "confirmation": {"type": "redirect", "return_url": return_url},
        "capture": True,
        "description": description[:128],
        "metadata": metadata,
    }
    req = urllib.request.Request(
        "https://api.yookassa.ru/v3/payments",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
            "Idempotence-Key": str(uuid.uuid4()),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("YooKassa error %s: %s", e.code, body)
        return None
    except Exception as e:
        logger.exception("YooKassa request failed: %s", e)
        return None


def get_payment(payment_id: str) -> dict | None:
    if not _configured() or not payment_id:
        return None
    auth = base64.b64encode(
        f"{settings.YOOKASSA_SHOP_ID}:{settings.YOOKASSA_SECRET_KEY}".encode()
    ).decode()
    req = urllib.request.Request(
        f"https://api.yookassa.ru/v3/payments/{payment_id}",
        headers={"Authorization": f"Basic {auth}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.exception("YooKassa get payment failed: %s", e)
        return None
