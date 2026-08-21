"""Отправка PDF-чека после успешной оплаты заказа кафе."""

from __future__ import annotations

import logging

from django.utils import timezone

from users.email_service import send_cafe_order_receipt_email

from .models import CafeOrder
from .receipt_pdf import build_cafe_order_receipt_pdf

logger = logging.getLogger(__name__)

SERVICE_CHARGE_PERCENT = 3


def _order_receipt_lines(order: CafeOrder) -> list[dict]:
    lines = []
    for row in order.items.all():
        lines.append(
            {
                "name": row.name,
                "quantity": row.quantity,
                "unit_price": row.unit_price,
                "line_total": row.line_total,
                "removed": row.removed_ingredients or [],
            }
        )
    return lines


def _order_receipt_text_lines(order: CafeOrder) -> list[str]:
    text_lines = []
    for row in order.items.all():
        suffix = ""
        removed = row.removed_ingredients or []
        if removed:
            suffix = f" (без: {', '.join(removed)})"
        text_lines.append(f"{row.name}{suffix} × {row.quantity} — {row.line_total} ₽")
    if order.delivery_fee > 0:
        text_lines.append(f"Доставка — {order.delivery_fee} ₽")
    if order.tip_amount > 0:
        if order.tip_custom:
            text_lines.append(f"Чаевые — {order.tip_amount} ₽")
        elif order.tip_percent:
            text_lines.append(f"Чаевые ({order.tip_percent}%) — {order.tip_amount} ₽")
        else:
            text_lines.append(f"Чаевые — {order.tip_amount} ₽")
    if order.include_service_charge and order.service_charge_amount > 0:
        text_lines.append(f"Сервисный сбор (3%) — {order.service_charge_amount} ₽")
    return text_lines


def build_order_receipt_pdf_bytes(order: CafeOrder):
    provider = order.provider
    paid_at = ""
    if order.paid_at:
        paid_at = timezone.localtime(order.paid_at).strftime("%d.%m.%Y %H:%M")
    try:
        return build_cafe_order_receipt_pdf(
            organization_name=provider.organization_name or provider.username,
            order_id=order.id,
            lines=_order_receipt_lines(order),
            items_total=order.items_total,
            delivery_fee=order.delivery_fee,
            tip_amount=order.tip_amount,
            tip_percent=order.tip_percent,
            tip_custom=order.tip_custom,
            service_charge_amount=order.service_charge_amount,
            include_service_charge=order.include_service_charge,
            total=order.total,
            pay_method=order.pay_method,
            paid_at=paid_at,
        )
    except Exception:
        logger.exception("Не удалось сгенерировать PDF для заказа #%s", order.id)
        return None


def send_order_receipt_after_payment(order: CafeOrder) -> bool:
    if not order.guest_email:
        return False
    provider = order.provider
    pdf_bytes = build_order_receipt_pdf_bytes(order)
    try:
        return send_cafe_order_receipt_email(
            email=order.guest_email,
            organization_name=provider.organization_name or provider.username,
            order_id=order.id,
            lines=_order_receipt_text_lines(order),
            total=f"{order.total} ₽",
            pdf_bytes=pdf_bytes,
        )
    except Exception:
        logger.exception("Не удалось отправить чек для заказа #%s", order.id)
        return False
