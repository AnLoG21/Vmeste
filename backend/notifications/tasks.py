from celery import shared_task


@shared_task
def noop_notification_task():
    return None


@shared_task(
    name="notifications.deliver_booking_event",
    ignore_result=True,
    time_limit=120,
    soft_time_limit=90,
)
def deliver_booking_event_task(
    booking_id: int,
    event: str,
    text: str,
    audience: str = "both",
    title_client: str = "",
    title_org: str = "",
):
    """Send booking fan-out off the request thread (SMS/email/TG/push can be slow)."""
    from django.db import close_old_connections

    close_old_connections()
    try:
        from booking.models import Booking

        from .delivery import deliver_booking_event

        booking = (
            Booking.objects.select_related("provider", "client", "service", "staff", "slot")
            .filter(pk=booking_id)
            .first()
        )
        if not booking:
            return {"skipped": "missing"}
        deliver_booking_event(
            booking,
            event,
            text,
            audience=audience,
            title_client=title_client or "",
            title_org=title_org or "",
        )
        return {"ok": True, "booking_id": booking_id, "event": event}
    finally:
        close_old_connections()


@shared_task(name="notifications.poll_telegram", time_limit=25, soft_time_limit=20)
def poll_telegram_task():
    from django.core.cache import cache

    from .telegram_api import delete_webhook, get_updates
    from .telegram_bot import handle_telegram_update, platform_bot_token

    token = platform_bot_token()
    if not token:
        return {"skipped": "no_token"}

    if not cache.get("telegram_webhook_cleared"):
        delete_webhook(token=token)
        cache.set("telegram_webhook_cleared", True, timeout=86400)

    offset = cache.get("telegram_update_offset")
    data = get_updates(token=token, offset=offset, timeout=0) or {}
    updates = data.get("result") or []
    last = offset
    for update in updates:
        if not isinstance(update, dict):
            continue
        try:
            handle_telegram_update(update)
        except Exception:
            import logging

            logging.getLogger(__name__).exception("telegram poll update failed")
        uid = update.get("update_id")
        if isinstance(uid, int):
            last = uid + 1
    if last is not None:
        cache.set("telegram_update_offset", last, timeout=None)
    return {"updates": len(updates)}
