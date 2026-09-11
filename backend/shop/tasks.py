from celery import shared_task


def _with_lock(key: str, timeout: int, fn):
    from django.core.cache import cache

    token = cache.add(key, "1", timeout=timeout)
    if not token:
        return {"ok": False, "dedup": True, "lock": key}
    try:
        return fn()
    finally:
        cache.delete(key)


@shared_task(
    bind=True,
    name="shop.sync_delivery_statuses",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
    acks_late=True,
)
def sync_delivery_statuses_task(self):
    from .delivery_sync import sync_active_deliveries

    return _with_lock("shop:lock:sync_delivery", 540, lambda: sync_active_deliveries(limit=100))
