"""YooKassa prepayment for service bookings (no-show protection)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from subscriptions.yookassa_client import create_payment

from .models import Booking, ProviderAcquiring

UNPAID_TTL_MINUTES = 20


def booking_service_total(booking) -> Decimal:
    total = Decimal(str(getattr(booking.service, "price", 0) or 0))
    for item in booking.selected_options or []:
        try:
            total += Decimal(str(item.get("price") or 0))
        except Exception:
            continue
    return total.quantize(Decimal("0.01"))


def get_or_create_acquiring(provider) -> ProviderAcquiring:
    obj, _ = ProviderAcquiring.objects.get_or_create(provider=provider)
    return obj


def resolve_yookassa_keys(provider) -> tuple[str, str]:
    shop = secret = ""
    acq = ProviderAcquiring.objects.filter(provider=provider).first()
    if acq:
        shop = (acq.yookassa_shop_id or "").strip()
        secret = (acq.yookassa_secret_key or "").strip()
    if (not shop or not secret) and getattr(provider, "provider_sphere", "") == "cafe_restaurant":
        cafe = getattr(provider, "cafe_settings", None)
        if cafe:
            shop = shop or (cafe.yookassa_shop_id or "").strip()
            secret = secret or (cafe.yookassa_secret_key or "").strip()
    return shop, secret


def prepay_public_info(provider) -> dict:
    acq = ProviderAcquiring.objects.filter(provider=provider).first()
    mode = (acq.prepay_mode if acq else ProviderAcquiring.PrepayMode.OFF) or ProviderAcquiring.PrepayMode.OFF
    percent = int(acq.prepay_percent) if acq else 50
    shop, secret = resolve_yookassa_keys(provider)
    ready = mode != ProviderAcquiring.PrepayMode.OFF and bool(shop and secret)
    return {
        "mode": mode,
        "percent": percent,
        "ready": ready,
    }


def expire_unpaid_bookings(provider_id=None) -> int:
    from .booking_actions import release_booking_occupancy

    qs = Booking.objects.filter(payment_status="pending", status=Booking.Status.NEW)
    if provider_id:
        qs = qs.filter(provider_id=provider_id)
    cutoff = timezone.now() - timedelta(minutes=UNPAID_TTL_MINUTES)
    n = 0
    for booking in qs.filter(created_at__lt=cutoff).select_related("slot"):
        booking.status = Booking.Status.CANCELLED
        booking.payment_status = "expired"
        booking.save(update_fields=["status", "payment_status"])
        release_booking_occupancy(booking)
        n += 1
    return n


def attach_prepay_if_needed(booking: Booking) -> dict | None:
    expire_unpaid_bookings(booking.provider_id)
    acq = ProviderAcquiring.objects.filter(provider_id=booking.provider_id).first()
    mode = (acq.prepay_mode if acq else ProviderAcquiring.PrepayMode.OFF) or ProviderAcquiring.PrepayMode.OFF
    if mode == ProviderAcquiring.PrepayMode.OFF:
        if booking.payment_status != "none":
            booking.payment_status = "none"
            booking.save(update_fields=["payment_status"])
        return None
    total = booking_service_total(booking)
    if total <= 0:
        return None
    if mode == ProviderAcquiring.PrepayMode.FULL:
        amount = total
    else:
        percent = min(100, max(1, int(getattr(acq, "prepay_percent", 50) or 50)))
        amount = (total * Decimal(percent) / Decimal(100)).quantize(Decimal("0.01"))
        if amount <= 0:
            amount = total
    shop, secret = resolve_yookassa_keys(booking.provider)
    if not shop or not secret:
        raise ValueError(
            "Организация включила предоплату, но не указала Shop ID и Secret Key ЮKassa."
        )
    front = (getattr(settings, "FRONTEND_URL", "") or "https://vsevmeste.space").rstrip("/")
    return_url = f"{front}/bookings?booking_payment=success&booking_id={booking.id}"
    yk = create_payment(
        amount=str(amount),
        description=f"Предоплата записи: {getattr(booking.service, 'name', 'услуга')}"[:128],
        return_url=return_url,
        metadata={"type": "booking", "booking_id": str(booking.id)},
        shop_id=shop,
        secret_key=secret,
    )
    if not yk:
        raise ValueError("Не удалось создать платёж в ЮKassa. Проверьте ключи магазина организации.")
    url = ((yk.get("confirmation") or {}).get("confirmation_url")) or ""
    booking.payment_status = "pending"
    booking.prepay_amount = amount
    booking.yookassa_payment_id = yk.get("id") or ""
    booking.payment_url = url
    booking.save(update_fields=["payment_status", "prepay_amount", "yookassa_payment_id", "payment_url"])
    if not url:
        raise ValueError("ЮKassa не вернула ссылку на оплату.")
    return {
        "confirmation_url": url,
        "prepay_amount": str(amount),
        "payment_status": "pending",
    }


def mark_booking_paid(booking: Booking) -> None:
    if booking.payment_status == "paid":
        return
    booking.payment_status = "paid"
    booking.paid_at = timezone.now()
    booking.save(update_fields=["payment_status", "paid_at"])
    try:
        from .booking_actions import notify_new_booking

        notify_new_booking(booking)
    except Exception:
        pass


def sync_booking_from_yookassa(booking: Booking) -> bool:
    if booking.payment_status == "paid":
        return True
    if not booking.yookassa_payment_id:
        return False
    from subscriptions.yookassa_client import get_payment

    shop, secret = resolve_yookassa_keys(booking.provider)
    yk = get_payment(booking.yookassa_payment_id, shop_id=shop, secret_key=secret)
    if yk and yk.get("status") == "succeeded":
        mark_booking_paid(booking)
        return True
    return False
