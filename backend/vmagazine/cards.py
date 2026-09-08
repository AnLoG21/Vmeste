"""Сохранение payment_method ЮKassa после успешной оплаты магазина."""

from __future__ import annotations

import logging
import re

from django.db import transaction

from .models import SavedPaymentCard

logger = logging.getLogger(__name__)


def _brand_from_pm(pm: dict) -> str:
    card = pm.get("card") or {}
    raw = str(card.get("card_type") or pm.get("type") or "card").lower()
    if "mir" in raw:
        return "mir"
    if "visa" in raw:
        return "visa"
    if "master" in raw:
        return "mastercard"
    if "amex" in raw or "american" in raw:
        return "amex"
    return (raw or "card")[:32]


def upsert_saved_card_from_yookassa_payment(*, user, provider, payment_obj: dict) -> SavedPaymentCard | None:
    """Если ЮKassa сохранила метод оплаты — записать/обновить карту покупателя для этого магазина."""
    if not user or not provider or not isinstance(payment_obj, dict):
        return None
    pm = payment_obj.get("payment_method") or {}
    method_id = str(pm.get("id") or "").strip()
    if not method_id or not pm.get("saved"):
        return None
    card = pm.get("card") or {}
    last4 = str(card.get("last4") or "").strip()
    if not re.fullmatch(r"\d{4}", last4):
        last4 = "0000"
    exp_month = int(card.get("expiry_month") or 1)
    exp_year = int(card.get("expiry_year") or 2030)
    brand = _brand_from_pm(pm)
    try:
        with transaction.atomic():
            existing = (
                SavedPaymentCard.objects.select_for_update()
                .filter(user=user, provider=provider, yookassa_payment_method_id=method_id)
                .first()
            )
            if existing:
                existing.brand = brand
                existing.last4 = last4
                existing.exp_month = exp_month
                existing.exp_year = exp_year
                existing.save(update_fields=["brand", "last4", "exp_month", "exp_year"])
                return existing
            is_default = not SavedPaymentCard.objects.filter(user=user, provider=provider).exists()
            if is_default:
                SavedPaymentCard.objects.filter(user=user, provider=provider).update(is_default=False)
            return SavedPaymentCard.objects.create(
                user=user,
                provider=provider,
                brand=brand,
                last4=last4,
                exp_month=exp_month,
                exp_year=exp_year,
                yookassa_payment_method_id=method_id,
                is_default=is_default,
            )
    except Exception:
        logger.exception("Failed to upsert saved card for user=%s provider=%s", getattr(user, "id", None), getattr(provider, "id", None))
        return None
