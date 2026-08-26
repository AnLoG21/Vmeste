"""YooKassa / multi-PSP prepayment for service bookings (no-show protection)."""

from __future__ import annotations

import secrets
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from payments.gateway import create_org_payment, provider_ready, sync_payment_status
from payments.resolve import resolve_org_payment_setup

from .models import Booking, ProviderAcquiring

UNPAID_TTL_MINUTES = 10


def booking_service_total(booking) -> Decimal:
    total = Decimal(str(getattr(booking.service, "price", 0) or 0))
    for item in booking.selected_options or []:
        try:
            total += Decimal(str(item.get("price") or 0))
        except Exception:
            continue
    return total.quantize(Decimal("0.01"))


def booking_payable_total(booking) -> Decimal:
    """Amount due after loyalty points discount."""
    total = booking_service_total(booking)
    discount = Decimal(str(getattr(booking, "loyalty_discount", 0) or 0))
    if discount < 0:
        discount = Decimal("0")
    payable = total - discount
    if payable < 0:
        payable = Decimal("0")
    return payable.quantize(Decimal("0.01"))


def get_or_create_acquiring(provider) -> ProviderAcquiring:
    obj, _ = ProviderAcquiring.objects.get_or_create(provider=provider)
    if not (obj.calendar_ics_token or "").strip():
        obj.calendar_ics_token = secrets.token_urlsafe(24)
        obj.save(update_fields=["calendar_ics_token"])
    return obj


def ensure_calendar_token(provider) -> str:
    acq = get_or_create_acquiring(provider)
    if not (acq.calendar_ics_token or "").strip():
        acq.calendar_ics_token = secrets.token_urlsafe(24)
        acq.save(update_fields=["calendar_ics_token"])
    return acq.calendar_ics_token


def resolve_payment_setup(provider) -> tuple[str, dict]:
    """Return (provider_code, creds) for booking prepay — общий слой payments.resolve."""
    return resolve_org_payment_setup(provider)


def resolve_yookassa_keys(provider) -> tuple[str, str]:
    """Back-compat helper for callers that still expect shop/secret pair."""
    code, creds = resolve_payment_setup(provider)
    if code != "yookassa":
        return "", ""
    return (creds.get("shop_id") or "").strip(), (creds.get("secret_key") or "").strip()


def prepay_public_info(provider) -> dict:
    acq = ProviderAcquiring.objects.filter(provider=provider).first()
    mode = (acq.prepay_mode if acq else ProviderAcquiring.PrepayMode.OFF) or ProviderAcquiring.PrepayMode.OFF
    percent = int(acq.prepay_percent) if acq else 50
    code, creds = resolve_payment_setup(provider)
    ready = mode != ProviderAcquiring.PrepayMode.OFF and provider_ready(code, creds)
    return {
        "mode": mode,
        "percent": percent,
        "ready": ready,
        "payment_provider": code,
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
    if getattr(booking, "client_package_id", None):
        # Оплата абонементом — предоплата не нужна
        if booking.payment_status != "paid":
            booking.payment_status = "paid"
            booking.prepay_amount = 0
            booking.save(update_fields=["payment_status", "prepay_amount"])
        return None
    acq = ProviderAcquiring.objects.filter(provider_id=booking.provider_id).first()
    mode = (acq.prepay_mode if acq else ProviderAcquiring.PrepayMode.OFF) or ProviderAcquiring.PrepayMode.OFF
    if mode == ProviderAcquiring.PrepayMode.OFF:
        if booking.payment_status != "none":
            booking.payment_status = "none"
            booking.save(update_fields=["payment_status"])
        return None
    payable = booking_payable_total(booking)
    # Баллы закрыли всю сумму — платёж не создаём
    if payable <= 0:
        booking.payment_status = "paid"
        booking.prepay_amount = 0
        if not booking.paid_at:
            booking.paid_at = timezone.now()
        booking.payment_url = ""
        booking.save(update_fields=["payment_status", "prepay_amount", "paid_at", "payment_url"])
        return None
    if mode == ProviderAcquiring.PrepayMode.FULL:
        amount = payable
    else:
        percent = min(100, max(1, int(getattr(acq, "prepay_percent", 50) or 50)))
        amount = (payable * Decimal(percent) / Decimal(100)).quantize(Decimal("0.01"))
        if amount <= 0:
            amount = payable
    code, creds = resolve_payment_setup(booking.provider)
    if not provider_ready(code, creds):
        raise ValueError(
            "Организация включила предоплату, но не указала ключи выбранного эквайера."
        )
    front = (getattr(settings, "FRONTEND_URL", "") or "https://vsevmeste.space").rstrip("/")
    return_url = f"{front}/bookings?booking_payment=success&booking_id={booking.id}"
    discount = Decimal(str(getattr(booking, "loyalty_discount", 0) or 0))
    desc = f"Предоплата записи: {getattr(booking.service, 'name', 'услуга')}"
    if discount > 0:
        desc = f"{desc} (скидка баллами {discount} ₽)"
    pay = create_org_payment(
        provider_code=code,
        creds=creds,
        amount=amount,
        description=desc[:128],
        return_url=return_url,
        fail_url=return_url,
        metadata={"type": "booking", "booking_id": str(booking.id)},
        order_id=f"b{booking.id}",
    )
    if not pay:
        raise ValueError("Не удалось создать платёж. Проверьте ключи эквайера организации.")
    url = pay.get("confirmation_url") or ""
    booking.payment_status = "pending"
    booking.prepay_amount = amount
    booking.yookassa_payment_id = pay.get("id") or ""
    booking.payment_url = url
    booking.save(update_fields=["payment_status", "prepay_amount", "yookassa_payment_id", "payment_url"])
    if not url:
        raise ValueError("Эквайер не вернул ссылку на оплату.")
    return {
        "confirmation_url": url,
        "prepay_amount": str(amount),
        "payment_status": "pending",
        "payment_provider": code,
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
    """Sync payment status from the configured PSP (name kept for call-site compat)."""
    if booking.payment_status == "paid":
        return True
    if not booking.yookassa_payment_id:
        return False
    code, creds = resolve_payment_setup(booking.provider)
    if sync_payment_status(provider_code=code, payment_id=booking.yookassa_payment_id, creds=creds):
        mark_booking_paid(booking)
        return True
    return False
