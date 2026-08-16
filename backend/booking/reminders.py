"""Periodic booking reminders (24h / 2h before slot)."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from .models import Booking


def send_booking_reminders() -> dict:
    now = timezone.now()
    # 24h window ±15 min
    w24_lo, w24_hi = now + timedelta(hours=24, minutes=-15), now + timedelta(hours=24, minutes=15)
    # 2h window ±10 min
    w2_lo, w2_hi = now + timedelta(hours=2, minutes=-10), now + timedelta(hours=2, minutes=10)

    active = Q(status__in=[Booking.Status.NEW, Booking.Status.CONFIRMED], slot__isnull=False)
    n24 = n2 = 0

    from notifications.delivery import build_reminder_text, deliver_booking_event

    qs24 = (
        Booking.objects.filter(active)
        .filter(reminder_24h_sent=False, slot__starts_at__gte=w24_lo, slot__starts_at__lte=w24_hi)
        .select_related("provider", "client", "service", "slot")[:200]
    )
    for booking in qs24:
        text = build_reminder_text(booking)
        deliver_booking_event(
            booking,
            "remind_24h",
            text,
            audience="both",
            title_client="Напоминание о записи",
            title_org="Напоминание: запись через 24 ч",
        )
        booking.reminder_24h_sent = True
        booking.save(update_fields=["reminder_24h_sent"])
        n24 += 1

    qs2 = (
        Booking.objects.filter(active)
        .filter(reminder_2h_sent=False, slot__starts_at__gte=w2_lo, slot__starts_at__lte=w2_hi)
        .select_related("provider", "client", "service", "slot")[:200]
    )
    for booking in qs2:
        text = build_reminder_text(booking)
        deliver_booking_event(
            booking,
            "remind_2h",
            text,
            audience="both",
            title_client="Скоро запись",
            title_org="Напоминание: запись через 2 ч",
        )
        booking.reminder_2h_sent = True
        booking.save(update_fields=["reminder_2h_sent"])
        n2 += 1

    return {"reminders_24h": n24, "reminders_2h": n2}
