from celery import shared_task


@shared_task
def noop_notification_task():
    return None


@shared_task(name="notifications.poll_telegram")
def poll_telegram_task():
    from django.conf import settings
    from django.core.cache import cache

    from .telegram_api import delete_webhook, get_updates, get_webhook_info
    from .telegram_bot import handle_telegram_update, platform_bot_token

    token = platform_bot_token()
    if not token:
        return {"skipped": "no_token"}

    # RU VPS: Telegram often cannot POST webhook inbound. Polling via proxy works.
    flag = cache.get("telegram_webhook_cleared")
    if not flag:
        info = get_webhook_info(token=token) or {}
        url = ((info.get("result") or {}).get("url") or "").strip()
        if url:
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
