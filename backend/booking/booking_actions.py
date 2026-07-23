from django.contrib.auth import get_user_model
from django.utils import timezone

from chat.services import get_or_create_client_conversation, post_booking_message

from .models import Booking

User = get_user_model()


def client_display_name(user) -> str:
    if not user:
        return ""
    parts = [user.first_name or "", user.last_name or ""]
    name = " ".join(p for p in parts if p).strip()
    return name or user.username


def format_booking_when(booking) -> str:
    start = booking.slot.starts_at
    if not start:
        return ""
    local = timezone.localtime(start)
    return local.strftime("%d.%m.%Y %H:%M")


def booking_notification_payload(booking, *, extra=None) -> dict:
    slot = getattr(booking, "slot", None)
    service = getattr(booking, "service", None)
    start = getattr(slot, "starts_at", None) if slot else None
    end = getattr(slot, "ends_at", None) if slot else None
    data = {
        "booking_id": str(booking.id),
        "view": "bookings",
        "service_name": getattr(service, "name", "") or "",
        "client_name": client_display_name(getattr(booking, "client", None)),
        "starts_at": start.isoformat() if start else "",
        "ends_at": end.isoformat() if end else "",
        "when": format_booking_when(booking) if slot else "",
    }
    if extra:
        data.update(extra)
    return data


def notify_new_booking(booking):
    """Push + in-app notification to provider and assigned staff."""
    try:
        from notifications.models import InAppNotification
        from notifications.push import notify_users

        service_name = getattr(getattr(booking, "service", None), "name", None) or "Услуга"
        when = format_booking_when(booking) or ""
        client = client_display_name(getattr(booking, "client", None))
        parts = [p for p in (service_name, when) if p]
        body = " · ".join(parts)
        if client:
            body = f"{client}: {body}" if body else client
        recipients = {booking.provider_id}
        if booking.staff_id:
            recipients.add(booking.staff_id)
        notify_users(
            list(recipients),
            kind=InAppNotification.Kind.BOOKING,
            title="Новая запись",
            body=body[:240] or "Клиент записался",
            payload=booking_notification_payload(booking),
        )
    except Exception:
        pass


def confirm_booking(booking, actor):
    provider = booking.provider
    msg_tpl = (getattr(provider, "booking_confirm_message_default", None) or "").strip()
    if not msg_tpl:
        return False, "confirm_message_not_set"
    booking.status = Booking.Status.CONFIRMED
    booking.save(update_fields=["status"])
    text = msg_tpl.replace("{date}", format_booking_when(booking))
    post_booking_message(provider, booking.client, text, sender=actor)
    try:
        from notifications.models import InAppNotification
        from notifications.push import notify_users

        if booking.client_id:
            notify_users(
                [booking.client_id],
                kind=InAppNotification.Kind.BOOKING,
                title="Запись подтверждена",
                body=text[:240] or "Ваша запись подтверждена",
                payload=booking_notification_payload(booking),
            )
    except Exception:
        pass
    return True, None


def cancel_booking_by_org(booking, actor):
    provider = booking.provider
    msg_tpl = (getattr(provider, "booking_cancel_message_default", None) or "").strip()
    if not msg_tpl:
        return False, "cancel_message_not_set"
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status"])
    if booking.slot_id:
        booking.slot.is_booked = False
        booking.slot.save(update_fields=["is_booked"])
    text = msg_tpl.replace("{date}", format_booking_when(booking))
    post_booking_message(provider, booking.client, text, sender=actor)
    return True, None


def mark_booking_done(booking, actor):
    provider = booking.provider
    if booking.slot_id:
        start = booking.slot.starts_at
        if start and start > timezone.now():
            return False, "booking_not_started_yet"
    msg_tpl = (getattr(provider, "booking_done_message_default", None) or "").strip()
    if not msg_tpl:
        return False, "done_message_not_set"
    booking.status = Booking.Status.DONE
    booking.save(update_fields=["status"])
    text = msg_tpl.replace("{date}", format_booking_when(booking))
    post_booking_message(provider, booking.client, text, sender=actor)
    return True, None


def cancel_booking_by_client(booking):
    provider = booking.provider
    client = booking.client
    when = format_booking_when(booking)
    service_name = getattr(getattr(booking, "service", None), "name", None) or "Услуга"
    text = f"Клиент отменил запись на {when}."
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status"])
    if booking.slot_id:
        booking.slot.is_booked = False
        booking.slot.save(update_fields=["is_booked"])
    post_booking_message(provider, client, text, sender=client)
    try:
        from notifications.models import InAppNotification
        from notifications.push import notify_users

        client_name = client_display_name(client)
        body = " · ".join(p for p in (service_name, when) if p)
        if client_name:
            body = f"{client_name}: {body}" if body else client_name
        recipients = {provider.id if hasattr(provider, "id") else booking.provider_id}
        if booking.staff_id:
            recipients.add(booking.staff_id)
        notify_users(
            list(recipients),
            kind=InAppNotification.Kind.BOOKING,
            title="Запись отменена клиентом",
            body=body[:240] or text,
            payload=booking_notification_payload(booking),
        )
    except Exception:
        pass
    return True, None
