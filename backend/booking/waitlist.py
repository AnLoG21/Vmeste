"""Лист ожидания: уведомление при освобождении слота."""

from __future__ import annotations

from django.utils import timezone

from .models import WaitlistEntry


def mark_waitlist_booked_for_booking(booking) -> int:
    """When a waitlisted client books, close matching WAITING/NOTIFIED rows as BOOKED."""
    if not booking or not getattr(booking, "client_id", None) or not getattr(booking, "provider_id", None):
        return 0
    qs = WaitlistEntry.objects.filter(
        provider_id=booking.provider_id,
        client_id=booking.client_id,
        status__in=(WaitlistEntry.Status.WAITING, WaitlistEntry.Status.NOTIFIED),
    )
    service_id = getattr(booking, "service_id", None)
    if service_id:
        qs = qs.filter(service_id=service_id)
    return qs.update(status=WaitlistEntry.Status.BOOKED)


def notify_waitlist_after_slot_freed(provider_id: int, service_id: int | None = None) -> int:
    """Уведомить следующего в очереди (push + SMS/TG). Возвращает число уведомлений."""
    qs = (
        WaitlistEntry.objects.filter(
            provider_id=provider_id,
            status=WaitlistEntry.Status.WAITING,
        )
        .select_related("client", "provider", "service")
        .order_by("created_at")
    )
    if service_id:
        qs = qs.filter(service_id=service_id)
    entry = qs.first()
    if not entry:
        return 0

    org = (getattr(entry.provider, "organization_name", None) or "").strip() or "организация"
    svc = getattr(entry.service, "name", None) or "услуга"
    body = f"Освободилось время в «{org}» на «{svc}». Откройте карту и запишитесь, пока слот свободен."

    try:
        from notifications.models import InAppNotification
        from notifications.push import notify_users

        notify_users(
            [entry.client_id],
            kind=InAppNotification.Kind.BOOKING,
            title="Слот освободился",
            body=body[:240],
            payload={
                "view": "client_map",
                "provider_id": str(entry.provider_id),
                "service_id": str(entry.service_id),
                "waitlist_id": str(entry.id),
                "event": "waitlist_open",
            },
        )
    except Exception:
        pass

    try:
        from notifications.delivery import _fanout_user_channels, get_or_create_messaging

        msg = get_or_create_messaging(entry.provider)
        _fanout_user_channels(msg, entry.client, body)
    except Exception:
        pass

    entry.status = WaitlistEntry.Status.NOTIFIED
    entry.notified_at = timezone.now()
    entry.save(update_fields=["status", "notified_at"])
    return 1
