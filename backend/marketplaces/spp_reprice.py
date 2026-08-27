"""SPP-aware price calculation (from wildwise Repricer_WB strategies)."""

from __future__ import annotations

from math import ceil
from typing import Any


def calc_supplier_price_for_target_buyer(
    *,
    target_buyer_price: float,
    spp_percent: float,
    supplier_discount_percent: float = 0,
) -> int | None:
    """
    Given desired price for the buyer after WB SPP, and seller discount %,
    return the supplier (до СПП) price to upload.
    Mirrors SPPPriceStrategy from mp/Repricer_WB.
    """
    try:
        target = float(target_buyer_price)
        spp = float(spp_percent or 0)
        disc = float(supplier_discount_percent or 0)
    except (TypeError, ValueError):
        return None
    if target <= 0:
        return None
    if spp < 0 or spp >= 100:
        return None
    if disc < 0 or disc >= 100:
        return None
    after_spp = ceil(target / (1 - spp / 100.0)) if spp > 0 else ceil(target)
    if disc > 0:
        return int(ceil(after_spp / (1 - disc / 100.0)))
    return int(after_spp)


def should_reprice(*, client_price: float, supplier_price: float, spp_percent: float) -> bool:
    """Reprice when buyer sees less than supplier list and SPP is in (0, 50]."""
    try:
        return float(client_price) < float(supplier_price) and 0 < float(spp_percent) <= 50
    except (TypeError, ValueError):
        return False


def plan_spp_update(rule: dict[str, Any], observed: dict[str, Any]) -> dict[str, Any] | None:
    """
    rule: target_buyer_price, supplier_discount, offer_id, nm_id
    observed: client_price (after spp), supplier_price, spp_percent, current_price
    """
    spp = float(observed.get("spp_percent") or 0)
    client = float(observed.get("client_price") or 0)
    supplier = float(observed.get("supplier_price") or observed.get("current_price") or 0)
    target = float(rule.get("target_buyer_price") or 0)
    disc = float(rule.get("supplier_discount") or 0)
    if target <= 0:
        return None
    new_price = calc_supplier_price_for_target_buyer(
        target_buyer_price=target,
        spp_percent=spp,
        supplier_discount_percent=disc,
    )
    if new_price is None:
        return None
    reason = f"Цель покупателя {target:.0f} ₽ при СПП {spp:.1f}% → цена продавца {new_price}"
    return {
        "offer_id": str(rule.get("offer_id") or ""),
        "nm_id": str(rule.get("nm_id") or observed.get("nm_id") or ""),
        "old_price": int(round(supplier or float(observed.get("current_price") or 0))),
        "new_price": int(new_price),
        "spp_percent": spp,
        "client_price": client,
        "target_buyer_price": target,
        "reason": reason,
        "needs_change": abs(int(new_price) - int(round(supplier or 0))) >= 1,
    }
