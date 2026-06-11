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


def confirm_booking(booking, actor):
    provider = booking.provider
    msg_tpl = (getattr(provider, "booking_confirm_message_default", None) or "").strip()
    if not msg_tpl:
        return False, "confirm_message_not_set"
    booking.status = Booking.Status.CONFIRMED
    booking.save(update_fields=["status"])
    text = msg_tpl.replace("{date}", format_booking_when(booking))
    post_booking_message(provider, booking.client, text, sender=actor)
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
    text = f"Клиент отменил запись на {when}."
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status"])
    if booking.slot_id:
        booking.slot.is_booked = False
        booking.slot.save(update_fields=["is_booked"])
    post_booking_message(provider, client, text, sender=client)
    return True, None
