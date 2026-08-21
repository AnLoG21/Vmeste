"""Пуш-уведомления кафе владельцу и сотрудникам по правам."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _recipient_ids(provider, *, any_of: list[str]) -> list[int]:
    from booking.models import ProviderStaff

    ids = {int(provider.id)}
    for link in ProviderStaff.objects.filter(
        provider=provider,
        is_active=True,
        invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
    ).only("staff_id", "permissions"):
        perms = link.permissions if isinstance(link.permissions, dict) else {}
        if any(bool(perms.get(k)) for k in any_of):
            ids.add(int(link.staff_id))
    return list(ids)


def notify_cafe_staff(provider, *, title: str, body: str, kind: str, any_of: list[str], payload: dict | None = None) -> None:
    try:
        from notifications.push import notify_users

        notify_users(
            _recipient_ids(provider, any_of=any_of),
            kind=kind,
            title=title[:120],
            body=body[:240],
            payload={**(payload or {}), "sphere": "cafe_restaurant", "view": "cafe_orders"},
        )
    except Exception:
        logger.exception("cafe push failed kind=%s", kind)


def notify_new_cafe_order(order) -> None:
    provider = order.provider
    mode = getattr(order, "mode", "") or ""
    mode_label = {"dine_in": "в зале", "takeaway": "самовывоз", "delivery": "доставка"}.get(mode, mode)
    title = f"Новый заказ #{order.id}"
    body = f"{mode_label} · {order.total} ₽"
    keys = ["cafe_orders", "cafe_kitchen"]
    if mode == "delivery":
        keys.append("cafe_delivery")
    if mode == "dine_in":
        keys.append("cafe_seating")
    notify_cafe_staff(
        provider,
        title=title,
        body=body,
        kind="cafe_new_order",
        any_of=keys,
        payload={"order_id": order.id, "mode": mode, "status": order.status},
    )


def notify_waiter_call(table) -> None:
    provider = table.floor_plan.provider
    label = table.label or f"#{table.id}"
    notify_cafe_staff(
        provider,
        title="Вызов официанта",
        body=f"Стол {label}",
        kind="cafe_waiter_call",
        any_of=["cafe_orders", "cafe_seating"],
        payload={"table_id": table.id, "table_label": label},
    )
