"""Синхронизация статусов доставки перевозчика → ShopOrder."""

from __future__ import annotations

import logging
import re

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# Только вперёд по воронке (не откатываем done/cancelled).
_STATUS_RANK = {
    "awaiting_payment": 0,
    "paid": 1,
    "assembling": 2,
    "ready": 3,
    "to_courier": 4,
    "delivering": 5,
    "done": 6,
}


def _norm(raw: str) -> str:
    return re.sub(r"[^a-z0-9а-яё]+", "_", (raw or "").strip().lower()).strip("_")


def map_carrier_status(kind: str, raw: str) -> str | None:
    """Вернуть ShopOrder.Status.value или None (игнорировать)."""
    kind = (kind or "").strip().lower()
    s = _norm(raw)
    if not s or s in ("unknown", "created", "new"):
        return None

    if kind == "own":
        if s in ("delivering", "in_transit", "assigned"):
            return "delivering"
        return None

    if kind == "yandex":
        if s in (
            "delivered",
            "delivered_finish",
            "returned_finish",
        ):
            return "done"
        if s.startswith("cancel") or s in ("failed", "returned"):
            return None
        if s in (
            "performer_found",
            "pickup_arrived",
            "ready_for_pickup_confirmation",
            "pickuped",
            "delivery_arrived",
            "ready_for_delivery_confirmation",
            "returning",
            "return_arrived",
            "ready_for_return_confirmation",
            "performer_lookup",
            "performer_draft",
            "accepted",
            "ready_for_approval",
            "estimating",
        ):
            return "delivering"
        return None

    if kind == "cdek":
        if "deliver" in s and "not" not in s:
            return "done"
        if s in ("delivered", "vydan", "issued"):
            return "done"
        if s in ("not_delivered", "invalid", "removed"):
            return None
        if s in (
            "accepted",
            "created",
            "received_at_shipment_warehouse",
            "ready_for_shipment_in_sender_city",
            "taken_by_transporter",
            "sent_to_recipient_city",
            "accepted_at_recipient_city_warehouse",
            "accepted_at_pick_up_point",
            "taken_by_courier",
            "returned_to_sender_city",
            "ready_for_shipment_in_transit_city",
            "in_transit",
        ):
            return "delivering"
        # generic transit tokens
        if any(x in s for x in ("transit", "courier", "warehouse", "ship", "accept")):
            return "delivering"
        return None

    if kind == "russian_post":
        if any(x in s for x in ("вруч", "delivered", "vydacha", "получен")):
            return "done"
        if any(x in s for x in ("cancel", "возврат", "return")):
            return None
        if any(x in s for x in ("transit", "path", "обработ", "прибыл", "отправ", "delivery", "в_пути")):
            return "delivering"
        return None

    if kind == "dostavista":
        if s in ("completed", "finished", "done", "delivered"):
            return "done"
        if s in ("canceled", "cancelled", "failed", "returned"):
            return None
        if s in ("available", "active", "courier_assigned", "parcel_picked_up", "parcel_picked", "delayed"):
            return "delivering"
        return None

    return None


def _can_advance(current: str, mapped: str) -> bool:
    if current in ("done", "cancelled"):
        return False
    if mapped == current:
        return False
    return _STATUS_RANK.get(mapped, -1) > _STATUS_RANK.get(current, -1)


@transaction.atomic
def sync_order_delivery(order) -> dict:
    """
    Опросить перевозчика и при необходимости обновить статус заказа.
    Returns {ok, raw, mapped, updated, detail?}.
    """
    from .delivery import get_delivery_provider, resolve_order_delivery_kind
    from .models import ShopOrder, ShopSettings

    order = ShopOrder.objects.select_for_update().select_related("provider").get(pk=order.pk)
    tracking = (order.external_tracking_id or "").strip()
    if not tracking:
        return {"ok": False, "detail": "no_tracking"}
    if order.mode != ShopOrder.Mode.DELIVERY:
        return {"ok": False, "detail": "not_delivery"}
    if order.status in (ShopOrder.Status.DONE, ShopOrder.Status.CANCELLED):
        return {"ok": True, "raw": "", "mapped": None, "updated": False}

    settings_obj = ShopSettings.objects.filter(provider_id=order.provider_id).first()
    if not settings_obj:
        return {"ok": False, "detail": "no_settings"}

    kind = (order.external_delivery_provider or "").strip() or resolve_order_delivery_kind(
        order, settings_obj
    )
    if kind == "own":
        # Свой курьер без внешнего API — не дёргаем бесконечный «delivering».
        return {"ok": True, "raw": "own", "mapped": None, "updated": False, "kind": kind}

    try:
        dp = get_delivery_provider(settings_obj, kind)
        raw = dp.sync_status(tracking)
    except Exception as exc:
        logger.exception("delivery sync failed order=%s", order.pk)
        return {"ok": False, "detail": str(exc)[:200], "kind": kind}

    mapped = map_carrier_status(kind, raw)
    if not mapped or not _can_advance(order.status, mapped):
        return {"ok": True, "raw": raw, "mapped": mapped, "updated": False, "kind": kind}

    previous = order.status
    order.status = mapped
    order.save(update_fields=["status", "updated_at"])
    if mapped == ShopOrder.Status.DONE:
        try:
            from vmagazine.bonuses import accrue_order_bonuses

            accrue_order_bonuses(order)
        except Exception:
            logger.exception("accrue bonuses after delivery done order=%s", order.pk)
    try:
        from .notify import notify_shop_order_status

        notify_shop_order_status(order, previous_status=previous)
    except Exception:
        logger.exception("notify after delivery sync order=%s", order.pk)

    return {
        "ok": True,
        "raw": raw,
        "mapped": mapped,
        "updated": True,
        "kind": kind,
        "previous": previous,
        "synced_at": timezone.now().isoformat(),
    }


def sync_active_deliveries(*, limit: int = 80) -> dict:
    from .models import ShopOrder

    qs = (
        ShopOrder.objects.filter(
            mode=ShopOrder.Mode.DELIVERY,
            status__in=[ShopOrder.Status.TO_COURIER, ShopOrder.Status.DELIVERING],
        )
        .exclude(external_tracking_id="")
        .order_by("updated_at")[:limit]
    )
    updated = 0
    failed = 0
    checked = 0
    for order in qs:
        checked += 1
        try:
            result = sync_order_delivery(order)
            if result.get("updated"):
                updated += 1
            if not result.get("ok"):
                failed += 1
        except Exception:
            failed += 1
            logger.exception("sync_active_deliveries order=%s", order.pk)
    return {"ok": True, "checked": checked, "updated": updated, "failed": failed}
