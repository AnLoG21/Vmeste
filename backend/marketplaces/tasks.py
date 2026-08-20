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
    name="marketplaces.sync_pending_imports",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    acks_late=True,
)
def sync_pending_imports_task(self):
    from .sync import sync_pending_ozon_imports

    def _run():
        result = sync_pending_ozon_imports(limit=50)
        if int(result.get("failed") or 0) > 0:
            from django.contrib.auth import get_user_model

            from .models import MarketplaceProductHistory
            from .notify import notify_sync_error

            User = get_user_model()
            # Notify owners who had failures in this pass (best-effort)
            provider_ids = (
                MarketplaceProductHistory.objects.filter(marketplace="ozon", status="failed")
                .order_by("-updated_at")
                .values_list("provider_id", flat=True)[:20]
            )
            for pid in set(provider_ids):
                provider = User.objects.filter(id=pid).first()
                if provider:
                    notify_sync_error(provider, detail=f"Failed-импортов за проход: {result.get('failed')}")
        return result

    return _with_lock("mp:lock:sync_pending", 840, _run)


@shared_task(
    bind=True,
    name="marketplaces.sync_provider",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    acks_late=True,
)
def sync_provider_task(self, provider_id: int):
    from django.contrib.auth import get_user_model

    from .notify import notify_sync_error
    from .sync import sync_provider_marketplace

    User = get_user_model()
    provider = User.objects.filter(id=provider_id).first()
    if not provider:
        return {"ok": False, "error": "provider_not_found"}

    def _run():
        try:
            result = sync_provider_marketplace(provider)
            if int(result.get("failed") or 0) > 0:
                notify_sync_error(provider, detail=f"Синк: failed={result.get('failed')}, skipped={result.get('skipped')}")
            return result
        except Exception as exc:
            notify_sync_error(provider, detail=str(exc)[:300])
            raise

    return _with_lock(f"mp:lock:sync_provider:{provider_id}", 600, _run)


@shared_task(
    bind=True,
    name="marketplaces.poll_new_orders",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
)
def poll_new_orders_task(self):
    """Poll Ozon/WB for new orders and notify once per order id."""
    from datetime import timedelta

    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from .clients import OZON_ACTIONS, WB_ACTIONS, MarketplaceError, ozon_headers, request_json, wb_headers
    from .models import MarketplaceSettings
    from .notify import notify_new_orders

    User = get_user_model()

    def _run():
        checked = 0
        notified = 0
        for s in MarketplaceSettings.objects.filter(environment="prod").select_related("provider")[:80]:
            provider = s.provider
            if not provider:
                continue
            if not s.notify_on_new_orders:
                continue
            seen = s.last_seen_order_ids if isinstance(s.last_seen_order_ids, dict) else {}
            changed = False
            for mp_key, has in (("ozon", s.has_ozon()), ("wildberries", s.has_wb())):
                if not has:
                    continue
                try:
                    if mp_key == "ozon":
                        since = (timezone.now() - timedelta(days=2)).isoformat().replace("+00:00", "Z")
                        data = request_json(
                            provider=provider,
                            marketplace="ozon",
                            method="POST",
                            url=OZON_ACTIONS["orders.list"][1],
                            headers=ozon_headers(s),
                            json_body={
                                "dir": "DESC",
                                "filter": {"since": since, "to": timezone.now().isoformat().replace("+00:00", "Z")},
                                "limit": 50,
                                "offset": 0,
                            },
                        )
                        rows = (data.get("result") or {}).get("postings") or data.get("postings") or []
                        ids = []
                        for row in rows:
                            if not isinstance(row, dict):
                                continue
                            oid = str(row.get("posting_number") or row.get("order_id") or "").strip()
                            if oid:
                                ids.append(oid)
                    else:
                        data = request_json(
                            provider=provider,
                            marketplace="wb",
                            method="GET",
                            url=WB_ACTIONS["orders.list"][1],
                            headers=wb_headers(s),
                            json_body=None,
                        )
                        rows = data.get("orders") or data.get("data") or (data if isinstance(data, list) else [])
                        ids = []
                        for row in rows if isinstance(rows, list) else []:
                            if not isinstance(row, dict):
                                continue
                            oid = str(row.get("id") or row.get("orderId") or "").strip()
                            if oid:
                                ids.append(oid)
                except MarketplaceError:
                    continue
                except Exception:
                    continue
                checked += 1
                prev = set(str(x) for x in (seen.get(mp_key) or []) if x)
                fresh = [x for x in ids if x not in prev]
                if fresh and prev:
                    notify_new_orders(provider, marketplace=mp_key, count=len(fresh), sample=fresh)
                    notified += len(fresh)
                merged = list(dict.fromkeys(ids + list(prev)))[:200]
                seen[mp_key] = merged
                changed = True
            if changed:
                s.last_seen_order_ids = seen
                s.save(update_fields=["last_seen_order_ids", "updated_at"])
        return {"ok": True, "checked": checked, "notified": notified}

    return _with_lock("mp:lock:poll_orders", 240, _run)
