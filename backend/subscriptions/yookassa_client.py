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


def _auth_header() -> str:
    return base64.b64encode(
        f"{settings.YOOKASSA_SHOP_ID}:{settings.YOOKASSA_SECRET_KEY}".encode()
    ).decode()


def create_payment(
    *,
    amount: str,
    description: str,
    return_url: str,
    metadata: dict,
    shop_id: str | None = None,
    secret_key: str | None = None,
    save_payment_method: bool = False,
    payment_method_id: str | None = None,
) -> dict | None:
    sid = shop_id or settings.YOOKASSA_SHOP_ID
    secret = secret_key or settings.YOOKASSA_SECRET_KEY
    if not sid or not secret:
        return None
    payload = {
        "amount": {"value": f"{float(amount):.2f}", "currency": "RUB"},
        "capture": True,
        "description": description[:128],
        "metadata": metadata or {},
    }
    # Redirect confirmation нужен и для сохранённых карт (3‑D Secure).
    if return_url:
        payload["confirmation"] = {"type": "redirect", "return_url": return_url}
    if payment_method_id:
        payload["payment_method_id"] = str(payment_method_id)
    if save_payment_method and not payment_method_id:
        payload["save_payment_method"] = True
    auth = base64.b64encode(f"{sid}:{secret}".encode()).decode()
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


def get_payment(payment_id: str, shop_id: str | None = None, secret_key: str | None = None) -> dict | None:
    sid = shop_id or settings.YOOKASSA_SHOP_ID
    secret = secret_key or settings.YOOKASSA_SECRET_KEY
    if not sid or not secret or not payment_id:
        return None
    auth = base64.b64encode(f"{sid}:{secret}".encode()).decode()
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


def create_refund(
    *,
    payment_id: str,
    amount: str,
    description: str = "",
    shop_id: str | None = None,
    secret_key: str | None = None,
) -> dict | None:
    """Full or partial refund for a succeeded YooKassa payment."""
    sid = shop_id or settings.YOOKASSA_SHOP_ID
    secret = secret_key or settings.YOOKASSA_SECRET_KEY
    if not sid or not secret or not payment_id:
        return None
    payload = {
        "payment_id": payment_id,
        "amount": {"value": f"{float(amount):.2f}", "currency": "RUB"},
    }
    if description:
        payload["description"] = description[:250]
    auth = base64.b64encode(f"{sid}:{secret}".encode()).decode()
    req = urllib.request.Request(
        "https://api.yookassa.ru/v3/refunds",
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
        logger.error("YooKassa refund error %s: %s", e.code, body)
        return None
    except Exception as e:
        logger.exception("YooKassa refund failed: %s", e)
        return None
