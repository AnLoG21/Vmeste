"""Normalize Wildberries realization (buh) report rows for P&L / unit economics."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


def _dec(val, default: str = "0") -> Decimal:
    try:
        if val is None or val == "":
            return Decimal(default)
        return Decimal(str(val).replace(",", ".").replace(" ", ""))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(default)


def normalize_buh_row(row: dict[str, Any] | None) -> dict[str, Any]:
    """
    Map WB reportDetailByPeriod / realization fields to a stable shape
    (aligned with legacy wildwise/wb-man buh_report schemas).
    """
    r = row if isinstance(row, dict) else {}
    sku = str(r.get("sa_name") or r.get("supplierArticle") or r.get("vendorCode") or "").strip()
    nm = r.get("nm_id") or r.get("nmId") or r.get("nmID") or ""
    brand = str(r.get("brand_name") or r.get("brandName") or r.get("brand") or "").strip()
    oper = str(r.get("supplier_oper_name") or r.get("supplierOperName") or r.get("doc_type_name") or "").strip()
    qty = int(_dec(r.get("quantity") or r.get("quantityFull") or 0))
    retail = _dec(r.get("retail_amount") or r.get("retailAmount") or r.get("retail_price_withdisc_rub") or 0)
    for_pay = _dec(r.get("ppvz_for_pay") or r.get("ppvzForPay") or r.get("finishedPrice") or 0)
    commission = _dec(r.get("ppvz_sales_commission") or r.get("ppvzSalesCommission") or 0)
    commission_pct = _dec(r.get("commission_percent") or r.get("commissionPercent") or 0)
    delivery = _dec(r.get("delivery_rub") or r.get("deliveryRub") or 0)
    storage = _dec(r.get("storage_fee") or r.get("storageFee") or 0)
    logistics_rebill = _dec(r.get("rebill_logistic_cost") or r.get("rebillLogisticCost") or 0)
    penalty = _dec(r.get("penalty") or 0)
    spp = _dec(r.get("ppvz_spp_prc") or r.get("ppvzSppPrc") or r.get("spp") or 0)
    reward = _dec(r.get("ppvz_reward") or r.get("ppvzReward") or 0)
    date_s = str(
        r.get("rr_dt") or r.get("sale_dt") or r.get("saleDt") or r.get("order_dt") or r.get("date") or ""
    )[:10]
    is_sale = "продаж" in oper.lower() or oper.lower() in ("продажа", "sale", "")
    is_return = "возврат" in oper.lower() or "return" in oper.lower()
    return {
        "sku": sku or str(nm or "SKU"),
        "nm_id": str(nm) if nm not in (None, "") else "",
        "brand": brand,
        "operation": oper,
        "is_sale": is_sale and not is_return,
        "is_return": is_return,
        "quantity": qty,
        "retail_amount": float(retail),
        "for_pay": float(for_pay),
        "commission": float(commission),
        "commission_percent": float(commission_pct),
        "delivery_rub": float(delivery),
        "storage_fee": float(storage),
        "rebill_logistic_cost": float(logistics_rebill),
        "penalty": float(penalty),
        "spp_percent": float(spp),
        "reward": float(reward),
        "date": date_s,
        "raw": r,
    }


def aggregate_buh_rows(rows: list[dict]) -> dict[str, Any]:
    """KPI + by-SKU + by-day + by-brand from normalized rows."""
    norms = [normalize_buh_row(r) for r in rows if isinstance(r, dict)]
    orders_sum = 0.0
    sales_pay = 0.0
    commission = 0.0
    logistics = 0.0
    storage = 0.0
    qty_sale = 0
    qty_return = 0
    by_sku: dict[str, dict] = {}
    by_day: dict[str, dict] = {}
    by_brand: dict[str, dict] = {}

    for n in norms:
        sign = -1 if n["is_return"] else 1
        pay = n["for_pay"] * sign
        retail = n["retail_amount"] * sign
        q = n["quantity"] * sign
        if n["is_return"]:
            qty_return += abs(n["quantity"])
        else:
            qty_sale += max(0, n["quantity"])
            orders_sum += max(0.0, retail)
        sales_pay += pay
        commission += n["commission"]
        logistics += n["delivery_rub"] + n["rebill_logistic_cost"]
        storage += n["storage_fee"]

        sku = n["sku"]
        slot = by_sku.setdefault(
            sku,
            {"sku": sku, "nm_id": n["nm_id"], "brand": n["brand"], "qty": 0, "retail": 0.0, "for_pay": 0.0},
        )
        slot["qty"] += q
        slot["retail"] += retail
        slot["for_pay"] += pay

        day = n["date"] or "—"
        dslot = by_day.setdefault(day, {"date": day, "qty": 0, "retail": 0.0, "for_pay": 0.0})
        dslot["qty"] += q
        dslot["retail"] += retail
        dslot["for_pay"] += pay

        brand = n["brand"] or "—"
        bslot = by_brand.setdefault(brand, {"brand": brand, "qty": 0, "for_pay": 0.0})
        bslot["qty"] += q
        bslot["for_pay"] += pay

    return {
        "kpis": {
            "orders_sum": round(orders_sum, 2),
            "for_pay": round(sales_pay, 2),
            "commission": round(commission, 2),
            "logistics": round(logistics, 2),
            "storage": round(storage, 2),
            "qty_sale": qty_sale,
            "qty_return": qty_return,
            "profit_est": round(sales_pay - logistics - storage, 2),
        },
        "by_sku": sorted(by_sku.values(), key=lambda x: x["for_pay"], reverse=True),
        "by_day": sorted(by_day.values(), key=lambda x: x["date"]),
        "by_brand": sorted(by_brand.values(), key=lambda x: x["for_pay"], reverse=True),
        "rows": norms,
    }
