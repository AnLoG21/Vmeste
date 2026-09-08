"""Оплата заказов магазина — отдельно от views, чтобы webhooks не тянули DRF-циклы."""

from django.utils import timezone

from .models import ShopOrder
from .stock import writeoff_shop_order


def mark_shop_order_paid(order: ShopOrder) -> None:
    was_paid = order.status == ShopOrder.Status.PAID or bool(order.paid_at)
    previous = order.status
    if order.status in (ShopOrder.Status.CANCELLED, ShopOrder.Status.DONE):
        return
    if order.status == ShopOrder.Status.AWAITING_PAYMENT or not order.paid_at:
        order.status = ShopOrder.Status.PAID
        order.paid_at = timezone.now()
        order.save(update_fields=["status", "paid_at", "updated_at"])
    if not was_paid:
        writeoff_shop_order(order)
        try:
            from .notify import notify_shop_order_status

            notify_shop_order_status(order, previous_status=previous)
        except Exception:
            pass
