"""Outbound confirmation calls (phase 2 — queue + pending list)."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from booking.models import Booking


def pending_confirmation_bookings(provider_id: int, *, hours_ahead: int = 36) -> list[dict]:
    """Bookings tomorrow-ish that are not cancelled and not yet confirmed by phone."""
    now = timezone.now()
    window_end = now + timedelta(hours=hours_ahead)
    qs = (
        Booking.objects.filter(
            provider_id=provider_id,
            status__in=[Booking.Status.NEW, Booking.Status.CONFIRMED],
            slot__starts_at__gte=now,
            slot__starts_at__lte=window_end,
        )
        .select_related("slot", "service", "client")
        .order_by("slot__starts_at")[:50]
    )
    rows = []
    for b in qs:
        slot = b.slot
        starts = slot.starts_at if slot else None
        phone = getattr(b.client, "phone", "") or ""
        rows.append(
            {
                "id": b.id,
                "status": b.status,
                "client_phone": phone,
                "service_name": getattr(b.service, "name", "") or "",
                "starts_at": starts.isoformat() if starts else "",
                "starts_at_label": starts.strftime("%d.%m.%Y %H:%M") if starts else "",
            }
        )
    return rows
