"""Фоновая синхронизация маркетплейсов (статусы импорта Ozon)."""

from __future__ import annotations

import logging

from django.db.models import QuerySet
from django.utils import timezone

logger = logging.getLogger(__name__)


def _sync_history_rows(qs: QuerySet, *, limit: int = 40) -> dict:
    from .clients import (
        OZON_ACTIONS,
        MarketplaceError,
        apply_import_identifiers_to_history,
        ozon_headers,
        request_json,
        summarize_ozon_import_status,
    )
    from .models import MarketplaceSettings

    ok = 0
    failed = 0
    skipped = 0
    for hist in qs.select_related("provider").order_by("-updated_at")[:limit]:
        resp = hist.response if isinstance(hist.response, dict) else {}
        task_id = resp.get("task_id")
        if not task_id:
            skipped += 1
            continue
        try:
            settings_obj = MarketplaceSettings.objects.filter(provider=hist.provider).first()
            if not settings_obj or settings_obj.environment != "prod" or not settings_obj.has_ozon():
                skipped += 1
                continue
            data = request_json(
                provider=hist.provider,
                marketplace="ozon",
                method="POST",
                url=OZON_ACTIONS["products.import_info"][1],
                headers=ozon_headers(settings_obj),
                json_body={"task_id": int(task_id)},
            )
            summary = summarize_ozon_import_status(data)
            merged = dict(resp)
            merged["task_id"] = int(task_id)
            merged["import_status"] = summary["status"]
            merged["import_items"] = summary["items"]
            err_bits = [r.get("errors") for r in summary["items"] if r.get("errors")]
            merged["import_errors"] = "; ".join(err_bits[:3])
            merged["import_info"] = data
            merged["synced_at"] = timezone.now().isoformat()
            hist.response = merged
            if summary["status"] == "success":
                hist.status = "success"
                ok += 1
            elif summary["status"] == "failed":
                hist.status = "failed"
                failed += 1
            else:
                skipped += 1
            hist.save(update_fields=["status", "response", "updated_at"])
            apply_import_identifiers_to_history(hist, "ozon", summary_items=summary["items"])
        except MarketplaceError as exc:
            logger.info("ozon sync skip hist=%s: %s", hist.id, exc)
            skipped += 1
        except Exception:
            logger.exception("ozon sync failed hist=%s", hist.id)
            failed += 1
    return {"ok": ok, "failed": failed, "skipped": skipped, "checked": ok + failed + skipped}


def sync_pending_ozon_imports(*, limit: int = 40) -> dict:
    from .models import MarketplaceProductHistory

    qs = MarketplaceProductHistory.objects.filter(marketplace="ozon", status="pending")
    return _sync_history_rows(qs, limit=limit)


def sync_provider_marketplace(provider) -> dict:
    from .models import MarketplaceProductHistory, MarketplaceSettings

    s, _ = MarketplaceSettings.objects.get_or_create(provider=provider)
    qs = MarketplaceProductHistory.objects.filter(provider=provider, marketplace="ozon", status="pending")
    result = _sync_history_rows(qs, limit=30)
    s.last_sync_at = timezone.now()
    s.save(update_fields=["last_sync_at", "updated_at"])
    result["provider_id"] = provider.id
    result["pending_left"] = MarketplaceProductHistory.objects.filter(
        provider=provider, marketplace="ozon", status="pending"
    ).count()
    result["synced_at"] = s.last_sync_at.isoformat()
    return result
