"""Periodic booking reminders (24h / 2h) and win-back «давно не был»."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Max, Q
from django.utils import timezone

from .models import Booking, ProviderMessagingSettings, WinbackReminderLog


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

    winback = send_winback_reminders()
    return {"reminders_24h": n24, "reminders_2h": n2, **winback}


def send_winback_reminders(*, limit: int = 80) -> dict:
    """Clients whose last completed visit was ≥ N weeks ago and no future booking."""
    now = timezone.now()
    sent = 0
    settings_qs = ProviderMessagingSettings.objects.filter(winback_enabled=True).select_related("provider")[:200]

    from notifications.delivery import deliver_winback_message, render_reminder_template

    for msg in settings_qs:
        weeks = max(1, min(52, int(msg.winback_weeks or 4)))
        threshold = now - timedelta(weeks=weeks)
        # Do not re-send more often than the same interval
        cooldown = now - timedelta(weeks=weeks)

        last_visits = (
            Booking.objects.filter(
                provider_id=msg.provider_id,
                status=Booking.Status.DONE,
                client__isnull=False,
            )
            .values("client_id")
            .annotate(last_at=Max("slot__starts_at"), last_created=Max("created_at"))
        )

        for row in last_visits:
            client_id = row["client_id"]
            last_at = row["last_at"] or row["last_created"]
            if not last_at or last_at > threshold:
                continue

            # Skip if client has upcoming booking
            has_future = Booking.objects.filter(
                provider_id=msg.provider_id,
                client_id=client_id,
                status__in=[Booking.Status.NEW, Booking.Status.CONFIRMED],
            ).filter(Q(slot__starts_at__gte=now) | Q(slot__isnull=True, created_at__gte=now - timedelta(days=2))).exists()
            if has_future:
                continue

            log = WinbackReminderLog.objects.filter(provider_id=msg.provider_id, client_id=client_id).first()
            if log and log.last_sent_at and log.last_sent_at > cooldown:
                continue

            from django.contrib.auth import get_user_model

            User = get_user_model()
            client = User.objects.filter(pk=client_id).first()
            if not client:
                continue
            if not getattr(client, "notify_booking_reminders", True):
                continue

            org = (getattr(msg.provider, "organization_name", None) or "").strip() or "салоне"
            text = render_reminder_template(
                msg.winback_text(),
                org=org,
                weeks=str(weeks),
                service="",
                date="",
                client=(getattr(client, "first_name", None) or client.username or "клиент"),
            )
            deliver_winback_message(
                msg.provider,
                client,
                text,
                title="Мы скучаем",
            )
            WinbackReminderLog.objects.update_or_create(
                provider_id=msg.provider_id,
                client_id=client_id,
                defaults={"weeks_at_send": weeks},
            )
            sent += 1
            if sent >= limit:
                return {"winback": sent}

    return {"winback": sent}
