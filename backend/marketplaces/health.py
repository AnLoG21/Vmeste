"""Structural + live probes for Ozon / WB / Yandex Market Seller APIs."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone

from .clients import (
    OZON_ACTIONS,
    WB_ACTIONS,
    YANDEX_ACTIONS,
    MarketplaceError,
    normalize_ozon_orders_list_payload,
    ozon_headers,
    request_json,
    wb_headers,
    yandex_market_headers,
)
from .models import MarketplaceSettings

logger = logging.getLogger(__name__)

# Endpoints that must stay on these path versions (fail closed on drift).
REQUIRED_OZON_PATHS = {
    "orders.list": "/v4/posting/fbs/list",
    "orders.ship": "/v4/posting/fbs/ship",
    "orders.label.create": "/v3/posting/fbs/package-label/create",
    "orders.label.get": "/v2/posting/fbs/package-label/get",
    "finance.list": "/v1/finance/accrual/by-day",
    "products.list": "/v3/product/list",
    "products.stocks_info": "/v4/product/info/stocks",
}

def structural_audit() -> list[dict[str, Any]]:
    """Check wired action URLs against known-good versions (no network)."""
    issues: list[dict[str, Any]] = []
    for key, needle in REQUIRED_OZON_PATHS.items():
        url = (OZON_ACTIONS.get(key) or ("", ""))[1]
        if needle not in url:
            issues.append(
                {
                    "marketplace": "ozon",
                    "check": f"structural:{key}",
                    "ok": False,
                    "detail": f"Ожидался путь с «{needle}», сейчас: {url}",
                }
            )
    # Sync package-label (no /create|/get) must not be registered
    for key, (_m, url) in OZON_ACTIONS.items():
        if url.rstrip("/").endswith("/v2/posting/fbs/package-label"):
            issues.append(
                {
                    "marketplace": "ozon",
                    "check": f"structural:banned:{key}",
                    "ok": False,
                    "detail": f"Устаревший sync package-label всё ещё в таблице: {url}",
                }
            )
    if "orders.stickers" not in WB_ACTIONS:
        issues.append(
            {
                "marketplace": "wildberries",
                "check": "structural:orders.stickers",
                "ok": False,
                "detail": "Нет WB orders.stickers в таблице действий",
            }
        )
    for key in ("campaigns.list", "orders.list", "orders.label"):
        if key not in YANDEX_ACTIONS:
            issues.append(
                {
                    "marketplace": "yandex",
                    "check": f"structural:{key}",
                    "ok": False,
                    "detail": f"Нет Yandex action «{key}»",
                }
            )
    if not issues:
        issues.append({"marketplace": "all", "check": "structural", "ok": True, "detail": "Пути API актуальны"})
    return issues


def _probe(name: str, marketplace: str, fn) -> dict[str, Any]:
    try:
        fn()
        return {"marketplace": marketplace, "check": name, "ok": True, "detail": "ok"}
    except MarketplaceError as exc:
        return {
            "marketplace": marketplace,
            "check": name,
            "ok": False,
            "detail": str(exc)[:400],
            "status_code": getattr(exc, "status_code", None),
        }
    except Exception as exc:
        return {"marketplace": marketplace, "check": name, "ok": False, "detail": str(exc)[:400]}


def live_probes_for_settings(s: MarketplaceSettings) -> list[dict[str, Any]]:
    """Read-only live pings using one seller's keys."""
    provider = s.provider
    out: list[dict[str, Any]] = []
    if not provider:
        return out

    if s.has_ozon():
        headers = ozon_headers(s)

        def ozon_products():
            request_json(
                provider=provider,
                marketplace="ozon",
                method="POST",
                url=OZON_ACTIONS["products.list"][1],
                headers=headers,
                json_body={"filter": {"visibility": "ALL"}, "last_id": "", "limit": 1},
            )

        def ozon_orders():
            since = (timezone.now() - timedelta(days=2)).isoformat().replace("+00:00", "Z")
            to = timezone.now().isoformat().replace("+00:00", "Z")
            request_json(
                provider=provider,
                marketplace="ozon",
                method="POST",
                url=OZON_ACTIONS["orders.list"][1],
                headers=headers,
                json_body=normalize_ozon_orders_list_payload(
                    {"dir": "DESC", "filter": {"since": since, "to": to}, "limit": 1}
                ),
            )

        def ozon_finance():
            day = (date.today() - timedelta(days=1)).isoformat()
            request_json(
                provider=provider,
                marketplace="ozon",
                method="POST",
                url=OZON_ACTIONS["finance.list"][1],
                headers=headers,
                json_body={"date": day},
            )

        def ozon_warehouses():
            request_json(
                provider=provider,
                marketplace="ozon",
                method="POST",
                url=OZON_ACTIONS["warehouses.list"][1],
                headers=headers,
                json_body={},
            )

        out.append(_probe("products.list", "ozon", ozon_products))
        out.append(_probe("orders.list", "ozon", ozon_orders))
        out.append(_probe("finance.list", "ozon", ozon_finance))
        out.append(_probe("warehouses.list", "ozon", ozon_warehouses))

    if s.has_wb():
        headers = wb_headers(s)

        def wb_products():
            request_json(
                provider=provider,
                marketplace="wildberries",
                method="POST",
                url=WB_ACTIONS["products.list"][1],
                headers=headers,
                json_body={"settings": {"cursor": {"limit": 1}, "filter": {"withPhoto": -1}}},
            )

        def wb_orders():
            request_json(
                provider=provider,
                marketplace="wildberries",
                method="GET",
                url=WB_ACTIONS["orders.list"][1],
                headers=headers,
            )

        def wb_warehouses():
            request_json(
                provider=provider,
                marketplace="wildberries",
                method="GET",
                url=WB_ACTIONS["warehouses.list"][1],
                headers=headers,
            )

        out.append(_probe("products.list", "wildberries", wb_products))
        out.append(_probe("orders.list", "wildberries", wb_orders))
        out.append(_probe("warehouses.list", "wildberries", wb_warehouses))

    if s.has_yandex_market():
        headers = yandex_market_headers(s)

        def ym_campaigns():
            request_json(
                provider=provider,
                marketplace="yandex",
                method="GET",
                url=YANDEX_ACTIONS["campaigns.list"][1],
                headers=headers,
                params={"pageSize": 1},
            )

        out.append(_probe("campaigns.list", "yandex", ym_campaigns))
        cid = (s.yandex_market_campaign_id or "").strip()
        if cid:

            def ym_orders():
                from .clients import resolve_url

                url = resolve_url(YANDEX_ACTIONS["orders.list"][1], {"campaignId": cid})
                request_json(
                    provider=provider,
                    marketplace="yandex",
                    method="GET",
                    url=url,
                    headers=headers,
                    params={"pageSize": 1},
                )

            out.append(_probe("orders.list", "yandex", ym_orders))

    return out


def run_marketplace_api_health(*, max_accounts: int = 5) -> dict[str, Any]:
    """
    Structural audit + live probes against up to N prod accounts with keys.
    Returns {ok, checks, failures, probed_accounts}.
    """
    checks = structural_audit()
    probed = 0
    qs = (
        MarketplaceSettings.objects.filter(environment="prod")
        .select_related("provider")
        .order_by("-updated_at")[:80]
    )
    for s in qs:
        if not (s.has_ozon() or s.has_wb() or s.has_yandex_market()):
            continue
        checks.extend(live_probes_for_settings(s))
        probed += 1
        if probed >= max_accounts:
            break

    if probed == 0:
        checks.append(
            {
                "marketplace": "all",
                "check": "live",
                "ok": True,
                "detail": "Нет боевых кабинетов с ключами — live-пинг пропущен (структурный аудит выполнен)",
            }
        )

    failures = [c for c in checks if not c.get("ok")]
    return {
        "ok": not failures,
        "checked_at": timezone.now().isoformat(),
        "probed_accounts": probed,
        "checks": checks,
        "failures": failures,
    }


def health_alert_email() -> str:
    return (
        (getattr(settings, "MARKETPLACE_HEALTH_EMAIL", "") or "").strip()
        or (getattr(settings, "SUPPORT_EMAIL", "") or "").strip()
        or "vmesteofficialsupport@gmail.com"
    )


def send_health_failure_email(report: dict[str, Any]) -> bool:
    """Email support when any marketplace probe failed."""
    from users.email_service import _send_branded

    failures = report.get("failures") or []
    if not failures:
        return False
    to = health_alert_email()
    lines = []
    for f in failures[:40]:
        lines.append(
            f"- [{f.get('marketplace')}] {f.get('check')}: {f.get('detail')}"
            + (f" (HTTP {f.get('status_code')})" if f.get("status_code") else "")
        )
    text = (
        f"Проверка API маркетплейсов ({report.get('checked_at')})\n"
        f"Кабинетов с live-пингом: {report.get('probed_accounts')}\n\n"
        f"Сбои ({len(failures)}):\n"
        + "\n".join(lines)
        + "\n\nРасписание: 13:00 и 02:00 Europe/Moscow (Celery Beat)."
    )
    html_paras = [f"Кабинетов с live-пингом: {report.get('probed_accounts')}", "Сбои:"] + lines
    subject = f"[Вместе] Маркетплейсы: сбой API ({len(failures)})"
    try:
        return bool(
            _send_branded(
                to=to,
                subject=subject,
                text_body=text,
                html_body=(
                    "<pre style='font-family:Segoe UI,Arial,sans-serif;white-space:pre-wrap;'>"
                    + text.replace("&", "&amp;").replace("<", "&lt;")
                    + "</pre>"
                ),
            )
        )
    except Exception:
        logger.exception("marketplace health email failed")
        return False
