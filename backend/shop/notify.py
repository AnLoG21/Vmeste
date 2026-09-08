"""Пуш-уведомления по заказам магазина."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

STATUS_LABELS = {
    "awaiting_payment": "ожидает оплаты",
    "paid": "оплачен",
    "assembling": "собирается",
    "ready": "готов",
    "to_courier": "передан курьеру",
    "delivering": "в пути",
    "done": "завершён",
    "cancelled": "отменён",
}


def _provider_recipient_ids(provider) -> list[int]:
    from booking.models import ProviderStaff

    ids = {int(provider.id)}
    for link in ProviderStaff.objects.filter(
        provider=provider,
        is_active=True,
        invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
    ).only("staff_id", "permissions"):
        perms = link.permissions if isinstance(link.permissions, dict) else {}
        if perms.get("shop_orders") or perms.get("shop_manage") or perms.get("orders"):
            ids.add(int(link.staff_id))
    return list(ids)


def notify_shop_users(user_ids, *, title: str, body: str, payload: dict | None = None) -> None:
    try:
        from notifications.push import notify_users

        notify_users(
            user_ids,
            kind="shop_order",
            title=title[:120],
            body=body[:240],
            payload={**(payload or {}), "sphere": "shops", "view": "vmagazine"},
        )
    except Exception:
        logger.exception("shop push failed")


def notify_new_shop_order(order) -> None:
    provider = order.provider
    mode = getattr(order, "mode", "") or ""
    mode_label = {"pickup": "самовывоз", "delivery": "доставка"}.get(mode, mode)
    notify_shop_users(
        _provider_recipient_ids(provider),
        title=f"Новый заказ #{order.id}",
        body=f"{mode_label} · {order.total} ₽",
        payload={"order_id": order.id, "status": order.status, "mode": mode},
    )


def notify_shop_order_status(order, *, previous_status: str = "") -> None:
    if not order.client_id:
        return
    if previous_status and previous_status == order.status:
        return
    label = STATUS_LABELS.get(order.status, order.status)
    shop = order.provider.organization_name or order.provider.username if order.provider_id else "Магазин"
    notify_shop_users(
        [order.client_id],
        title=f"Заказ #{order.id}",
        body=f"{shop}: статус «{label}»",
        payload={"order_id": order.id, "status": order.status},
    )
