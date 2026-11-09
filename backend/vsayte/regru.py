"""REG.RU partner API client for domain check / register / DNS.

Without credentials (or in DEBUG) returns mock responses so the product flow works locally.
"""

from __future__ import annotations

import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

REGRU_API = "https://api.reg.ru/api/regru2"


def _creds() -> tuple[str, str]:
    user = getattr(settings, "REGRU_USERNAME", "") or ""
    password = getattr(settings, "REGRU_PASSWORD", "") or ""
    return user.strip(), password.strip()


def configured() -> bool:
    u, p = _creds()
    return bool(u and p)


def _call(method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    username, password = _creds()
    if not username or not password:
        return {"result": "error", "error_code": "NO_CREDENTIALS", "error_text": "REG.RU not configured"}

    data = {
        "username": username,
        "password": password,
        "output_format": "json",
        **(payload or {}),
    }
    url = f"{REGRU_API}/{method}"
    try:
        resp = requests.post(url, data=data, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.exception("REG.RU %s failed", method)
        return {"result": "error", "error_code": "REQUEST_FAILED", "error_text": str(exc)}


def check_domain(domain: str) -> dict[str, Any]:
    domain = (domain or "").strip().lower()
    if not domain:
        return {"ok": False, "available": False, "detail": "Укажите домен."}

    if not configured():
        # Mock: treat .ru / .рф as available in DEBUG-style environments
        return {
            "ok": True,
            "available": True,
            "domain": domain,
            "mock": True,
            "price": "199.00",
            "currency": "RUR",
            "detail": "Проверка в тестовом режиме (REG.RU не настроен).",
        }

    raw = _call("domain/check", {"domains": f'[{{"dname":"{domain}"}}]'})
    if raw.get("result") != "success":
        return {
            "ok": False,
            "available": False,
            "domain": domain,
            "detail": raw.get("error_text") or "Не удалось проверить домен.",
            "raw": raw,
        }

    domains = (raw.get("answer") or {}).get("domains") or []
    item = domains[0] if domains else {}
    result_code = item.get("result")
    available = result_code == "Available"
    return {
        "ok": True,
        "available": available,
        "domain": domain,
        "price": str(item.get("price") or ""),
        "currency": item.get("currency") or "RUR",
        "raw": raw,
    }


def register_domain(domain: str, *, period: int = 1) -> dict[str, Any]:
    domain = (domain or "").strip().lower()
    if not configured():
        return {
            "ok": True,
            "mock": True,
            "domain": domain,
            "order_id": f"mock-{domain}",
            "service_id": f"mock-svc-{domain}",
            "detail": "Заказ домена принят в тестовом режиме (REG.RU не настроен).",
        }

    raw = _call(
        "domain/create",
        {
            "domain_name": domain,
            "period": str(period),
        },
    )
    if raw.get("result") != "success":
        return {
            "ok": False,
            "domain": domain,
            "detail": raw.get("error_text") or "Не удалось зарегистрировать домен.",
            "raw": raw,
        }
    answer = raw.get("answer") or {}
    return {
        "ok": True,
        "domain": domain,
        "order_id": str(answer.get("order_id") or answer.get("bill_id") or ""),
        "service_id": str(answer.get("service_id") or ""),
        "raw": raw,
    }


def set_dns_a(domain: str, ip: str) -> dict[str, Any]:
    domain = (domain or "").strip().lower()
    ip = (ip or "").strip()
    if not configured():
        return {
            "ok": True,
            "mock": True,
            "domain": domain,
            "ip": ip,
            "detail": "DNS A записан в тестовом режиме.",
        }

    raw = _call(
        "zone/add_alias",
        {
            "domain_name": domain,
            "subdomain": "@",
            "ipaddr": ip,
        },
    )
    if raw.get("result") != "success":
        # Fallback: replace / update may need different method depending on existing records
        return {
            "ok": False,
            "domain": domain,
            "detail": raw.get("error_text") or "Не удалось выставить DNS A.",
            "raw": raw,
        }
    return {"ok": True, "domain": domain, "ip": ip, "raw": raw}
