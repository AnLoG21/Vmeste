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
    slot = getattr(booking, "slot", None)
    start = getattr(slot, "starts_at", None) if slot else None
    if not start:
        return ""
    local = timezone.localtime(start)
    return local.strftime("%d.%m.%Y %H:%M")


def release_booking_occupancy(booking):
    """
    Освободить время после отмены записи.
    Если поверх остался исходный свободный интервал — удаляем слот-занятость.
    Иначе (старые записи, когда бронь заняла сам интервал) — просто снимаем is_booked.
    """
    from .models import AvailabilitySlot

    slot = getattr(booking, "slot", None)
    if not slot:
        return
    covered_by_free = (
        AvailabilitySlot.objects.filter(
            provider_id=slot.provider_id,
            is_booked=False,
            starts_at__lte=slot.starts_at,
            ends_at__gte=slot.ends_at,
        )
        .exclude(pk=slot.pk)
        .exists()
    )
    if covered_by_free:
        booking.slot = None
        booking.save(update_fields=["slot"])
        slot.delete()
        return
    slot.is_booked = False
    if getattr(slot, "hold_label", None):
        slot.hold_label = ""
        slot.save(update_fields=["is_booked", "hold_label"])
    else:
        slot.save(update_fields=["is_booked"])


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
    """Push + channels to provider and assigned staff."""
    try:
        from notifications.delivery import build_new_booking_text, deliver_booking_event

        body = build_new_booking_text(booking)
        deliver_booking_event(
            booking,
            "new",
            body or "Клиент записался",
            audience="org",
            title_org="Новая запись",
        )
    except Exception:
        pass


def confirm_booking(booking, actor):
    provider = booking.provider
    msg_tpl = (getattr(provider, "booking_confirm_message_default", None) or "").strip()
    if not msg_tpl:
        return False, "confirm_message_not_set"
    if getattr(booking, "payment_status", "none") == "pending":
        return False, "prepay_required"
    booking.status = Booking.Status.CONFIRMED
    booking.save(update_fields=["status"])
    text = msg_tpl.replace("{date}", format_booking_when(booking))
    post_booking_message(provider, booking.client, text, sender=actor)
    try:
        from notifications.delivery import deliver_booking_event

        deliver_booking_event(
            booking,
            "confirm",
            text,
            audience="client",
            title_client="Запись подтверждена",
        )
    except Exception:
        pass
    return True, None


def cancel_booking_by_org(booking, actor):
    provider = booking.provider
    msg_tpl = (getattr(provider, "booking_cancel_message_default", None) or "").strip()
    if not msg_tpl:
        return False, "cancel_message_not_set"
    when = format_booking_when(booking)
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status"])
    release_booking_occupancy(booking)
    text = msg_tpl.replace("{date}", when)
    post_booking_message(provider, booking.client, text, sender=actor)
    try:
        from notifications.delivery import deliver_booking_event

        deliver_booking_event(
            booking,
            "cancel",
            text,
            audience="client",
            title_client="Запись отменена",
        )
    except Exception:
        pass
    return True, None


def mark_booking_done(booking, actor):
    provider = booking.provider
    slot = getattr(booking, "slot", None)
    if slot:
        start = slot.starts_at
        if start and start > timezone.now():
            return False, "booking_not_started_yet"
    msg_tpl = (getattr(provider, "booking_done_message_default", None) or "").strip()
    if not msg_tpl:
        return False, "done_message_not_set"
    booking.status = Booking.Status.DONE
    booking.save(update_fields=["status"])
    text = msg_tpl.replace("{date}", format_booking_when(booking))
    post_booking_message(provider, booking.client, text, sender=actor)
    try:
        from notifications.delivery import deliver_booking_event

        deliver_booking_event(
            booking,
            "done",
            text,
            audience="client",
            title_client="Услуга оказана",
        )
    except Exception:
        pass
    return True, None


def cancel_booking_by_client(booking):
    provider = booking.provider
    client = booking.client
    when = format_booking_when(booking)
    service_name = getattr(getattr(booking, "service", None), "name", None) or "Услуга"
    text = f"Клиент отменил запись на {when}."
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status"])
    release_booking_occupancy(booking)
    post_booking_message(provider, client, text, sender=client)
    try:
        from notifications.delivery import deliver_booking_event

        client_name = client_display_name(client)
        body = " · ".join(p for p in (service_name, when) if p)
        if client_name:
            body = f"{client_name}: {body}" if body else client_name
        deliver_booking_event(
            booking,
            "cancel_by_client",
            body or text,
            audience="org",
            title_org="Запись отменена клиентом",
        )
    except Exception:
        pass
    return True, None
