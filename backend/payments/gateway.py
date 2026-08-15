"""Unified create/check payment for organization shops."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

from django.conf import settings

from subscriptions.yookassa_client import create_payment as yookassa_create
from subscriptions.yookassa_client import get_payment as yookassa_get

logger = logging.getLogger(__name__)

PROVIDERS = (
    ("yookassa", "ЮKassa"),
    ("tbank", "Т‑Банк (Тинькофф)"),
    ("cloudpayments", "CloudPayments"),
    ("robokassa", "Robokassa"),
)


def _amount_str(amount) -> str:
    return f"{Decimal(str(amount)):.2f}"


def _kopecks(amount) -> int:
    return int((Decimal(str(amount)) * 100).quantize(Decimal("1")))


def provider_ready(provider_code: str, creds: dict) -> bool:
    code = (provider_code or "yookassa").strip()
    if code == "yookassa":
        return bool((creds.get("shop_id") or "").strip() and (creds.get("secret_key") or "").strip())
    if code == "tbank":
        return bool((creds.get("terminal_key") or "").strip() and (creds.get("password") or "").strip())
    if code == "cloudpayments":
        return bool((creds.get("public_id") or "").strip() and (creds.get("api_secret") or "").strip())
    if code == "robokassa":
        return bool(
            (creds.get("merchant_login") or "").strip()
            and (creds.get("password1") or "").strip()
            and (creds.get("password2") or "").strip()
        )
    return False


def create_org_payment(
    *,
    provider_code: str,
    creds: dict,
    amount,
    description: str,
    return_url: str,
    fail_url: str | None = None,
    metadata: dict | None = None,
    order_id: str | None = None,
) -> dict | None:
    """
    Returns {id, confirmation_url, provider} or None.
    """
    code = (provider_code or "yookassa").strip() or "yookassa"
    meta = metadata or {}
    oid = order_id or str(uuid.uuid4())
    fail = fail_url or return_url
    if code == "yookassa":
        yk = yookassa_create(
            amount=_amount_str(amount),
            description=description,
            return_url=return_url,
            metadata=meta,
            shop_id=(creds.get("shop_id") or "").strip(),
            secret_key=(creds.get("secret_key") or "").strip(),
        )
        if not yk or not yk.get("id"):
            return None
        return {
            "id": yk.get("id"),
            "confirmation_url": ((yk.get("confirmation") or {}).get("confirmation_url")) or "",
            "provider": "yookassa",
        }
    if code == "tbank":
        return _tbank_init(
            terminal_key=(creds.get("terminal_key") or "").strip(),
            password=(creds.get("password") or "").strip(),
            amount=amount,
            description=description,
            return_url=return_url,
            fail_url=fail,
            order_id=oid,
            metadata=meta,
        )
    if code == "cloudpayments":
        return _cloudpayments_create(
            public_id=(creds.get("public_id") or "").strip(),
            api_secret=(creds.get("api_secret") or "").strip(),
            amount=amount,
            description=description,
            return_url=return_url,
            order_id=oid,
            metadata=meta,
        )
    if code == "robokassa":
        return _robokassa_create(
            merchant_login=(creds.get("merchant_login") or "").strip(),
            password1=(creds.get("password1") or "").strip(),
            amount=amount,
            description=description,
            return_url=return_url,
            order_id=oid,
            metadata=meta,
        )
    return None


def sync_payment_status(*, provider_code: str, payment_id: str, creds: dict) -> bool:
    """Return True if payment succeeded."""
    code = (provider_code or "yookassa").strip() or "yookassa"
    if not payment_id:
        return False
    if code == "yookassa":
        yk = yookassa_get(
            payment_id,
            shop_id=(creds.get("shop_id") or "").strip() or None,
            secret_key=(creds.get("secret_key") or "").strip() or None,
        )
        return bool(yk and yk.get("status") == "succeeded")
    if code == "tbank":
        return _tbank_paid(
            terminal_key=(creds.get("terminal_key") or "").strip(),
            password=(creds.get("password") or "").strip(),
            payment_id=payment_id,
        )
    if code == "cloudpayments":
        return _cloudpayments_paid(
            public_id=(creds.get("public_id") or "").strip(),
            api_secret=(creds.get("api_secret") or "").strip(),
            payment_id=payment_id,
        )
    # Robokassa has no reliable pull without InvoiceID mapping; webhook marks paid.
    return False


def _tbank_token(payload: dict, password: str) -> str:
    data = {k: v for k, v in payload.items() if k != "Token" and v is not None and not isinstance(v, (dict, list))}
    data["Password"] = password
    concat = "".join(str(data[k]) for k in sorted(data.keys()))
    return hashlib.sha256(concat.encode("utf-8")).hexdigest()


def _tbank_init(*, terminal_key, password, amount, description, return_url, fail_url, order_id, metadata) -> dict | None:
    if not terminal_key or not password:
        return None
    front = (getattr(settings, "FRONTEND_URL", "") or "https://vsevmeste.space").rstrip("/")
    # Notifications usually hit the same public host (nginx proxies /api → backend).
    notification_url = f"{front}/api/subscriptions/webhook/tbank/"
    payload = {
        "TerminalKey": terminal_key,
        "Amount": _kopecks(amount),
        "OrderId": str(order_id)[:36],
        "Description": (description or "")[:250],
        "SuccessURL": return_url,
        "FailURL": fail_url,
        "NotificationURL": notification_url,
        "DATA": {str(k): str(v) for k, v in (metadata or {}).items()},
    }
    payload["Token"] = _tbank_token(payload, password)
    req = urllib.request.Request(
        "https://securepay.tinkoff.ru/v2/Init",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("T-Bank Init error %s: %s", e.code, body)
        return None
    except Exception as e:
        logger.exception("T-Bank Init failed: %s", e)
        return None
    if not data.get("Success"):
        logger.error("T-Bank Init rejected: %s", data)
        return None
    return {
        "id": str(data.get("PaymentId") or ""),
        "confirmation_url": data.get("PaymentURL") or "",
        "provider": "tbank",
    }


def _tbank_paid(*, terminal_key, password, payment_id) -> bool:
    if not terminal_key or not password or not payment_id:
        return False
    payload = {"TerminalKey": terminal_key, "PaymentId": str(payment_id)}
    payload["Token"] = _tbank_token(payload, password)
    req = urllib.request.Request(
        "https://securepay.tinkoff.ru/v2/GetState",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return bool(data.get("Success") and str(data.get("Status") or "").upper() == "CONFIRMED")
    except Exception as e:
        logger.exception("T-Bank GetState failed: %s", e)
        return False


def _cloudpayments_create(*, public_id, api_secret, amount, description, return_url, order_id, metadata) -> dict | None:
    if not public_id or not api_secret:
        return None
    # Orders API → payment page URL
    payload = {
        "Amount": float(_amount_str(amount)),
        "Currency": "RUB",
        "Description": (description or "")[:255],
        "InvoiceId": str(order_id)[:50],
        "AccountId": str((metadata or {}).get("type") or "vmeste"),
        "Email": "",
        "JsonData": metadata or {},
        "SuccessRedirectUrl": return_url,
        "FailRedirectUrl": return_url,
    }
    auth = urllib.request.HTTPPasswordMgrWithDefaultRealm()
    # Basic PublicId:ApiSecret
    import base64

    token = base64.b64encode(f"{public_id}:{api_secret}".encode()).decode()
    req = urllib.request.Request(
        "https://api.cloudpayments.ru/orders/create",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("CloudPayments create error %s: %s", e.code, body)
        return None
    except Exception as e:
        logger.exception("CloudPayments create failed: %s", e)
        return None
    if not data.get("Success"):
        logger.error("CloudPayments rejected: %s", data)
        return None
    model = data.get("Model") or {}
    return {
        "id": str(model.get("Id") or order_id),
        "confirmation_url": model.get("Url") or "",
        "provider": "cloudpayments",
    }


def _cloudpayments_paid(*, public_id, api_secret, payment_id) -> bool:
    if not public_id or not api_secret or not payment_id:
        return False
    import base64

    token = base64.b64encode(f"{public_id}:{api_secret}".encode()).decode()
    # Try find payment by InvoiceId / TransactionId
    payload = {"TransactionId": payment_id}
    req = urllib.request.Request(
        "https://api.cloudpayments.ru/payments/get",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Basic {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("Success") and (data.get("Model") or {}).get("Status") == "Completed":
            return True
    except Exception:
        pass
    return False


def _robokassa_create(*, merchant_login, password1, amount, description, return_url, order_id, metadata) -> dict | None:
    if not merchant_login or not password1:
        return None
    # InvId must be integer for classic Robokassa — hash booking/order into positive int
    try:
        inv_id = int(str(order_id).lstrip("0") or "0") % 2147483647
        if inv_id <= 0:
            inv_id = abs(hash(str(order_id))) % 2147483647 or 1
    except Exception:
        inv_id = abs(hash(str(order_id))) % 2147483647 or 1
    out_sum = _amount_str(amount)
    shp = {f"Shp_{k}": str(v) for k, v in (metadata or {}).items()}
    # Signature: MerchantLogin:OutSum:InvId:Password1[:Shp_...]
    shp_part = "".join(f":{k}={shp[k]}" for k in sorted(shp.keys()))
    sign_str = f"{merchant_login}:{out_sum}:{inv_id}:{password1}{shp_part}"
    signature = hashlib.md5(sign_str.encode("utf-8")).hexdigest()
    params = {
        "MerchantLogin": merchant_login,
        "OutSum": out_sum,
        "InvId": str(inv_id),
        "Description": (description or "")[:100],
        "SignatureValue": signature,
        "Culture": "ru",
        "Encoding": "utf-8",
        "IsTest": "0",
        **shp,
    }
    url = "https://auth.robokassa.ru/Merchant/Index.aspx?" + urllib.parse.urlencode(params)
    return {
        "id": str(inv_id),
        "confirmation_url": url,
        "provider": "robokassa",
    }


def verify_tbank_token(payload: dict, password: str) -> bool:
    token = str(payload.get("Token") or "")
    if not token or not password:
        return False
    expected = _tbank_token(payload, password)
    return hmac.compare_digest(token.lower(), expected.lower())


def verify_cloudpayments_hmac(body: bytes, signature_header: str, api_secret: str) -> bool:
    if not api_secret or not signature_header:
        return False
    digest = hmac.new(api_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature_header.strip())


def verify_robokassa_result(*, out_sum: str, inv_id: str, signature: str, password2: str, shp: dict) -> bool:
    shp_part = "".join(f":{k}={shp[k]}" for k in sorted(shp.keys()))
    sign_str = f"{out_sum}:{inv_id}:{password2}{shp_part}"
    expected = hashlib.md5(sign_str.encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected.lower(), (signature or "").lower())
