from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .clients import (
    MarketplaceError,
    OZON_ACTIONS,
    WB_ACTIONS,
    apply_import_identifiers_to_history,
    build_ozon_item,
    build_wb_card,
    fetch_wb_nm_id,
    generate_local_ean13,
    humanize_api_error,
    normalize_marketplace_images,
    normalize_product_identifiers,
    ozon_headers,
    parse_ozon_product_item,
    request_bytes,
    request_json,
    resolve_url,
    summarize_ozon_import_status,
    validate_product_for_import,
    wb_headers,
)
from .models import (
    MarketplaceApiLog,
    MarketplaceProductHistory,
    MarketplaceReplyTemplate,
    MarketplaceSettings,
    MarketplaceTemplate,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _clean_ai_description(text: str) -> str:
    import re

    value = str(text or "").replace("\r", "")
    value = re.sub(r"[*_`#]+", "", value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def _provider(user):
    if not user or not user.is_authenticated:
        return None
    if getattr(user, "role", None) != User.Role.PROVIDER:
        return None
    if getattr(user, "provider_sphere", "") != User.ProviderSphere.MARKETPLACES:
        return None
    return user


def _staff_marketplace_link(user):
    """Accepted staff link to a marketplaces provider, if any."""
    if not user or not user.is_authenticated:
        return None
    if getattr(user, "role", None) != User.Role.STAFF:
        return None
    from booking.models import ProviderStaff

    return (
        ProviderStaff.objects.filter(
            staff=user,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            provider__role=User.Role.PROVIDER,
            provider__provider_sphere=User.ProviderSphere.MARKETPLACES,
        )
        .select_related("provider")
        .first()
    )


def _full_marketplace_perms():
    return {
        "marketplace_view_keys": True,
        "marketplace_manage_orders": True,
        "marketplace_manage_catalog": True,
    }


def _staff_marketplace_perms(link) -> dict:
    perms = link.permissions if isinstance(link.permissions, dict) else {}
    return {
        "marketplace_view_keys": bool(perms.get("marketplace_view_keys")),
        "marketplace_manage_orders": bool(perms.get("marketplace_manage_orders", True)),
        "marketplace_manage_catalog": bool(perms.get("marketplace_manage_catalog")),
    }


def _resolve_marketplace_access(request):
    """
    Returns (provider, perms_dict, error_response).
    Provider is always the organization owner (marketplace sphere).
    """
    owner = _provider(request.user)
    if owner:
        return owner, _full_marketplace_perms(), None
    link = _staff_marketplace_link(request.user)
    if link:
        return link.provider, _staff_marketplace_perms(link), None
    return None, None, Response(
        {"detail": "Кабинет маркетплейсов доступен исполнителям этой сферы и их сотрудникам."},
        status=403,
    )


def _require_provider(request, *, need_keys=False, need_orders=False, need_catalog=False):
    provider, perms, err = _resolve_marketplace_access(request)
    if err:
        return None, err
    if need_keys and not perms.get("marketplace_view_keys"):
        return None, Response({"detail": "Нет права просматривать/менять ключи площадок."}, status=403)
    if need_orders and not perms.get("marketplace_manage_orders"):
        return None, Response({"detail": "Нет права работать с заказами маркетплейса."}, status=403)
    if need_catalog and not perms.get("marketplace_manage_catalog"):
        return None, Response({"detail": "Нет права управлять каталогом."}, status=403)
    request.marketplace_perms = perms
    return provider, None


def _settings(provider) -> MarketplaceSettings:
    obj, _ = MarketplaceSettings.objects.get_or_create(provider=provider)
    return obj


def _log_error_hint(error: str, status_code: int | None) -> str:
    msg = humanize_api_error(error, status_code)
    low = (error or "").lower()
    if "rate limit" in low or (status_code == 429):
        return f"{msg} → подождите 2–5 сек и повторите; не гоняйте массовые запросы подряд."
    if status_code in (401, 403) or "unauthorized" in low or "forbidden" in low:
        return f"{msg} → проверьте Client ID / API Key и боевой режим."
    if "subscription" in low or "permissiondenied" in low:
        return f"{msg} → откройте тариф/Premium в кабинете продавца."
    return f"{msg} → детали во вкладке «Логи»; исправьте данные и повторите действие."


def _active_api_log_errors(provider, *, marketplace: str = "", limit: int = 20) -> list[dict]:
    """Ошибки логов, которые ещё актуальны: последний вызов этого endpoint ещё с ошибкой.

    Исторические сбои после успешного повтора не показываются в алертах.
    """
    from django.db.models import Max

    qs = MarketplaceApiLog.objects.filter(provider=provider)
    mp = (marketplace or "").strip()
    if mp in ("ozon", "wildberries"):
        qs = qs.filter(marketplace__in=[mp, "wb" if mp == "wildberries" else mp, ""])

    latest_rows = (
        qs.values("marketplace", "endpoint")
        .annotate(latest_id=Max("id"))
        .order_by()
    )
    latest_ids = [row["latest_id"] for row in latest_rows if row.get("latest_id")]
    if not latest_ids:
        return []

    logs = (
        MarketplaceApiLog.objects.filter(id__in=latest_ids)
        .exclude(error_message="")
        .order_by("-id")[:limit]
    )
    return [
        {
            "id": log.id,
            "endpoint": log.endpoint,
            "status_code": log.status_code,
            "error": (log.error_message or "")[:300],
            "hint": _log_error_hint(log.error_message or "", log.status_code),
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "marketplace": log.marketplace,
        }
        for log in logs
    ]


def _upload_to_yandex_disk(token: str, filename: str, upload) -> str | None:
    import requests

    token = (token or "").strip()
    if not token:
        return None
    safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in (filename or "file"))[:80] or "file"
    path = f"app:/Vmeste/{safe}"
    headers = {"Authorization": f"OAuth {token}"}
    href_res = requests.get(
        "https://cloud-api.yandex.net/v1/disk/resources/upload",
        params={"path": path, "overwrite": "true"},
        headers=headers,
        timeout=20,
    )
    href = (href_res.json() if href_res.content else {}).get("href") or ""
    if not href:
        return None
    upload.seek(0)
    put_res = requests.put(href, data=upload, timeout=90)
    if not put_res.ok:
        return None
    requests.put(
        "https://cloud-api.yandex.net/v1/disk/resources/publish",
        params={"path": path},
        headers=headers,
        timeout=20,
    )
    meta = requests.get(
        "https://cloud-api.yandex.net/v1/disk/resources",
        params={"path": path, "fields": "public_url,file"},
        headers=headers,
        timeout=20,
    )
    body = meta.json() if meta.content else {}
    return (body.get("file") or body.get("public_url") or "").strip() or None


def _media_public_url(request, storage_name: str) -> str:
    from django.core.files.storage import default_storage

    rel = default_storage.url(storage_name)
    if str(rel).startswith("http"):
        return rel
    origin = (getattr(settings, "FRONTEND_URL", "") or "").strip().rstrip("/")
    if origin.startswith("http"):
        return f"{origin}{rel}"
    return request.build_absolute_uri(rel)


def _is_video_upload(upload) -> bool:
    content_type = (getattr(upload, "content_type", "") or "").lower()
    name = (getattr(upload, "name", "") or "").lower()
    return content_type.startswith("video/") or name.endswith((".webm", ".mp4", ".mov", ".m4v"))


def _history_item(row: MarketplaceProductHistory) -> dict:
    resp = row.response if isinstance(row.response, dict) else {}
    product = row.product_data if isinstance(row.product_data, dict) else {}
    return {
        "id": row.id,
        "marketplace": row.marketplace,
        "offer_id": row.offer_id,
        "vendor_code": product.get("vendor_code") or row.offer_id,
        "nm_id": product.get("nm_id"),
        "product_id": product.get("product_id"),
        "product": product,
        "status": row.status,
        "response": row.response,
        "import_task_id": resp.get("task_id"),
        "import_status": resp.get("import_status"),
        "import_errors": resp.get("import_errors") or "",
        "updated_at": row.updated_at.isoformat(),
    }


def _extract_ozon_task_id(resp: dict) -> int | None:
    if not isinstance(resp, dict):
        return None
    result = resp.get("result")
    if isinstance(result, dict) and result.get("task_id") is not None:
        try:
            return int(result["task_id"])
        except (TypeError, ValueError):
            return None
    if resp.get("task_id") is not None:
        try:
            return int(resp["task_id"])
        except (TypeError, ValueError):
            return None
    return None


def _prepare_product_for_marketplace(product: dict) -> dict:
    """Ensure image lists contain public HTTPS URLs before Ozon/WB payload build."""
    prepared = dict(product)
    public_images = normalize_marketplace_images(product)
    prepared["images"] = public_images
    prepared["wb_images"] = public_images
    return prepared


def _openrouter_proxies() -> dict | None:
    proxy = (getattr(settings, "OPENROUTER_HTTP_PROXY", None) or "").strip()
    if not proxy:
        return None
    return {"http": proxy, "https": proxy}


class MarketplaceSettingsView(APIView):
    def get(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        s = _settings(provider)
        perms = getattr(request, "marketplace_perms", _full_marketplace_perms())
        telegram_ready = False
        try:
            from notifications.delivery import get_or_create_messaging

            msg = get_or_create_messaging(provider)
            telegram_ready = bool(msg.enable_telegram and msg.has_telegram())
        except Exception:
            telegram_ready = False
        can_keys = bool(perms.get("marketplace_view_keys"))
        return Response(
            {
                "environment": s.environment,
                "ozon_client_id": s.ozon_client_id if can_keys else "",
                "has_ozon_api_key": s.has_ozon() if can_keys else False,
                "has_wb_api_key": s.has_wb() if can_keys else False,
                "has_yandex_disk": bool((s.yandex_disk_token or "").strip()) if can_keys else False,
                "yandex_disk_oauth": bool(settings.YANDEX_OAUTH_CLIENT_ID and settings.YANDEX_OAUTH_CLIENT_SECRET),
                "video_enabled": True,
                "ai_enabled": bool((getattr(settings, "OPENROUTER_API_KEY", "") or "").strip())
                or bool(
                    (getattr(settings, "OLLAMA_MODEL", "") or "").strip()
                    and (getattr(settings, "OLLAMA_API_URL", "") or "").strip()
                ),
                "ai_model": (
                    getattr(settings, "OPENROUTER_MODEL", "") or ""
                    if bool((getattr(settings, "OPENROUTER_API_KEY", "") or "").strip())
                    else (getattr(settings, "OLLAMA_MODEL", "") or "")
                ),
                "has_webhook_secret": bool((s.webhook_secret or "").strip()) if can_keys else False,
                "webhook_url": request.build_absolute_uri("/api/marketplaces/webhook/"),
                "last_sync_at": s.last_sync_at.isoformat() if s.last_sync_at else None,
                "low_stock_threshold": s.low_stock_threshold,
                "price_protect_enabled": s.price_protect_enabled,
                "price_min_floor_percent": s.price_min_floor_percent,
                "ozon_disable_auto_actions": s.ozon_disable_auto_actions,
                "notify_telegram": s.notify_telegram,
                "notify_push": s.notify_push,
                "notify_on_new_orders": s.notify_on_new_orders,
                "notify_on_sync_errors": s.notify_on_sync_errors,
                "permissions": perms,
                "telegram_ready": telegram_ready,
            }
        )

    def patch(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        perms = getattr(request, "marketplace_perms", _full_marketplace_perms())
        s = _settings(provider)
        data = request.data if isinstance(request.data, dict) else {}
        touches_keys = any(
            k in data
            for k in (
                "environment",
                "ozon_client_id",
                "ozon_api_key",
                "wb_api_key",
                "yandex_disk_token",
                "rotate_webhook_secret",
            )
        )
        if touches_keys and not perms.get("marketplace_view_keys"):
            return Response({"detail": "Нет права менять ключи площадок."}, status=403)
        env = (data.get("environment") or s.environment or "sandbox").strip()
        if "environment" in data and env in ("sandbox", "prod"):
            s.environment = env
        if "ozon_client_id" in data:
            s.ozon_client_id = str(data.get("ozon_client_id") or "").strip()
        key = str(data.get("ozon_api_key") or "").strip()
        if key and not key.startswith("•"):
            s.ozon_api_key = key
        wb = str(data.get("wb_api_key") or "").strip()
        if wb and not wb.startswith("•"):
            s.wb_api_key = wb
        if "yandex_disk_token" in data:
            disk = str(data.get("yandex_disk_token") or "").strip()
            if disk == "":
                s.yandex_disk_token = ""
            elif not disk.startswith("•"):
                s.yandex_disk_token = disk
        if data.get("rotate_webhook_secret"):
            import secrets

            s.webhook_secret = secrets.token_urlsafe(24)
            s.save()
            body = self.get(request).data
            if hasattr(body, "copy"):
                body = dict(body)
            body["webhook_secret"] = s.webhook_secret
            return Response(body)
        if "low_stock_threshold" in data:
            try:
                s.low_stock_threshold = max(0, min(int(data.get("low_stock_threshold") or 0), 100000))
            except (TypeError, ValueError):
                pass
        if "price_protect_enabled" in data:
            s.price_protect_enabled = bool(data.get("price_protect_enabled"))
        if "price_min_floor_percent" in data:
            try:
                s.price_min_floor_percent = max(0, min(int(data.get("price_min_floor_percent") or 0), 90))
            except (TypeError, ValueError):
                pass
        if "ozon_disable_auto_actions" in data:
            s.ozon_disable_auto_actions = bool(data.get("ozon_disable_auto_actions"))
        if "notify_telegram" in data:
            s.notify_telegram = bool(data.get("notify_telegram"))
        if "notify_push" in data:
            s.notify_push = bool(data.get("notify_push"))
        if "notify_on_new_orders" in data:
            s.notify_on_new_orders = bool(data.get("notify_on_new_orders"))
        if "notify_on_sync_errors" in data:
            s.notify_on_sync_errors = bool(data.get("notify_on_sync_errors"))
        s.save()
        return self.get(request)


class MarketplaceHistoryView(APIView):
    def get(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        qs = MarketplaceProductHistory.objects.filter(provider=provider)
        mp = (request.query_params.get("marketplace") or "").strip()
        if mp:
            qs = qs.filter(marketplace=mp)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(offer_id__icontains=q)
        items = []
        for row in qs[:200]:
            items.append(_history_item(row))
        return Response({"results": items})


class MarketplaceTemplateView(APIView):
    def get(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        rows = MarketplaceTemplate.objects.filter(provider=provider)
        return Response(
            {
                "results": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "description": t.description,
                        "marketplace": t.marketplace,
                        "brand": t.brand,
                        "description_text": t.description_text,
                        "price": str(t.price),
                        "stock": t.stock,
                    }
                    for t in rows
                ]
            }
        )

    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        t = MarketplaceTemplate.objects.create(
            provider=provider,
            name=str(data.get("name") or "Шаблон")[:180],
            description=str(data.get("description") or ""),
            marketplace=str(data.get("marketplace") or "ozon"),
            brand=str(data.get("brand") or "")[:180],
            description_text=str(data.get("description_text") or ""),
            price=data.get("price") or 0,
            stock=int(data.get("stock") or 0),
        )
        return Response({"id": t.id}, status=201)

    def delete(self, request, pk=None):
        provider, err = _require_provider(request)
        if err:
            return err
        MarketplaceTemplate.objects.filter(provider=provider, id=pk).delete()
        return Response({"ok": True})


class MarketplaceReplyTemplateView(APIView):
    def get(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        rows = MarketplaceReplyTemplate.objects.filter(provider=provider)
        kind = (request.query_params.get("kind") or "").strip()
        if kind in ("review", "question"):
            rows = rows.filter(kind=kind)
        return Response(
            {
                "results": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "marketplace": t.marketplace,
                        "kind": t.kind,
                        "body": t.body,
                    }
                    for t in rows[:100]
                ]
            }
        )

    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        body = str(data.get("body") or "").strip()
        if not body:
            return Response({"detail": "Введите текст шаблона ответа."}, status=400)
        kind = str(data.get("kind") or MarketplaceReplyTemplate.KIND_REVIEW).strip()
        if kind not in (MarketplaceReplyTemplate.KIND_REVIEW, MarketplaceReplyTemplate.KIND_QUESTION):
            kind = MarketplaceReplyTemplate.KIND_REVIEW
        mp = str(data.get("marketplace") or "any").strip()
        if mp not in ("ozon", "wildberries", "any"):
            mp = "any"
        t = MarketplaceReplyTemplate.objects.create(
            provider=provider,
            name=str(data.get("name") or "Шаблон ответа")[:180],
            marketplace=mp,
            kind=kind,
            body=body[:4000],
        )
        return Response({"id": t.id}, status=201)

    def delete(self, request, pk=None):
        provider, err = _require_provider(request)
        if err:
            return err
        MarketplaceReplyTemplate.objects.filter(provider=provider, id=pk).delete()
        return Response({"ok": True})


class MarketplaceAlertsView(APIView):
    def get(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        s = _settings(provider)
        mp = (request.query_params.get("marketplace") or "").strip()
        hist = MarketplaceProductHistory.objects.filter(provider=provider)
        if mp in ("ozon", "wildberries"):
            hist = hist.filter(marketplace=mp)

        low_stock = []
        failed_imports = []
        threshold = int(s.low_stock_threshold or 0)
        for row in hist.order_by("-updated_at")[:300]:
            product = row.product_data if isinstance(row.product_data, dict) else {}
            try:
                stock = int(product.get("stock") or 0)
            except (TypeError, ValueError):
                stock = 0
            if threshold >= 0 and stock <= threshold:
                low_stock.append(
                    {
                        "id": row.id,
                        "offer_id": row.offer_id,
                        "name": product.get("name") or row.offer_id,
                        "stock": stock,
                        "marketplace": row.marketplace,
                    }
                )
            status = str(row.status or "").lower()
            import_status = str((row.response or {}).get("import_status") or "").lower() if isinstance(row.response, dict) else ""
            if status == "failed" or import_status == "failed":
                err_msg = ""
                if isinstance(row.response, dict):
                    err_msg = str(row.response.get("import_errors") or row.response.get("error") or "")[:300]
                failed_imports.append(
                    {
                        "id": row.id,
                        "offer_id": row.offer_id,
                        "name": product.get("name") or row.offer_id,
                        "status": row.status,
                        "error": err_msg,
                        "marketplace": row.marketplace,
                    }
                )

        log_errors = _active_api_log_errors(provider, marketplace=mp, limit=20)

        return Response(
            {
                "low_stock_threshold": threshold,
                "low_stock": low_stock[:30],
                "failed_imports": failed_imports[:30],
                "log_errors": log_errors,
                "counts": {
                    "low_stock": len(low_stock),
                    "failed_imports": len(failed_imports),
                    "log_errors": len(log_errors),
                },
            }
        )


class MarketplaceOpsSummaryView(APIView):
    """Dashboard: what broke in the last N hours."""

    def get(self, request):
        from datetime import timedelta

        from django.utils import timezone

        provider, err = _require_provider(request)
        if err:
            return err
        try:
            hours = max(1, min(int(request.query_params.get("hours") or 24), 168))
        except (TypeError, ValueError):
            hours = 24
        since = timezone.now() - timedelta(hours=hours)
        failed = list(
            MarketplaceProductHistory.objects.filter(provider=provider, status="failed", updated_at__gte=since).order_by(
                "-updated_at"
            )[:50]
        )
        logs = list(
            MarketplaceApiLog.objects.filter(provider=provider, created_at__gte=since)
            .exclude(error_message="")
            .order_by("-id")[:50]
        )
        pending = MarketplaceProductHistory.objects.filter(provider=provider, status="pending").count()
        return Response(
            {
                "hours": hours,
                "since": since.isoformat(),
                "pending_imports": pending,
                "failed_imports": [
                    {
                        "id": row.id,
                        "offer_id": row.offer_id,
                        "marketplace": row.marketplace,
                        "error": str((row.response or {}).get("import_errors") or (row.response or {}).get("error") or "")[:300]
                        if isinstance(row.response, dict)
                        else "",
                        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                    }
                    for row in failed
                ],
                "log_errors": [
                    {
                        "id": log.id,
                        "endpoint": log.endpoint,
                        "status_code": log.status_code,
                        "error": (log.error_message or "")[:300],
                        "hint": _log_error_hint(log.error_message or "", log.status_code),
                        "created_at": log.created_at.isoformat() if log.created_at else None,
                    }
                    for log in logs
                ],
                "counts": {
                    "failed_imports": len(failed),
                    "log_errors": len(logs),
                    "pending_imports": pending,
                },
            }
        )


class MarketplaceOrderChatLinkView(APIView):
    """Link a marketplace order to Vmeste chat (client or org notes)."""

    def post(self, request):
        provider, err = _require_provider(request, need_orders=True)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        order_id = str(data.get("order_id") or data.get("posting_number") or "").strip()
        if not order_id:
            return Response({"detail": "Укажите order_id / posting_number."}, status=400)
        marketplace = "wildberries" if (data.get("marketplace") or "") == "wildberries" else "ozon"
        client = None
        client_id = data.get("client_id")
        if client_id not in (None, ""):
            try:
                client = User.objects.filter(id=int(client_id), role=User.Role.CLIENT).first()
            except (TypeError, ValueError):
                client = None
        try:
            from chat.services import post_marketplace_order_note

            msg = post_marketplace_order_note(
                provider,
                marketplace=marketplace,
                order_id=order_id,
                text=str(data.get("text") or ""),
                sender=request.user,
                client=client,
            )
        except Exception as exc:
            logger.exception("order chat link failed")
            return Response({"detail": str(exc)[:300]}, status=400)
        return Response(
            {
                "ok": True,
                "conversation_id": msg.conversation_id,
                "message_id": msg.id,
                "linked_to_client": bool(client),
            }
        )


class MarketplaceImportView(APIView):
    def post(self, request):
        provider, err = _require_provider(request, need_catalog=True)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        marketplace = (data.get("marketplace") or "ozon").strip()
        products = data.get("products") if isinstance(data.get("products"), list) else []
        if not products:
            one = {k: data.get(k) for k in ("offer_id", "name", "brand", "price", "stock", "description", "images", "barcode", "category", "type", "characteristics", "wb_sku", "wb_images")}
            if one.get("offer_id") or one.get("name"):
                products = [one]
        if not products:
            return Response({"detail": "Нет товаров для выгрузки."}, status=400)
        if len(products) > 100:
            return Response({"detail": "Не больше 100 товаров за раз."}, status=400)

        s = _settings(provider)
        mp_key = "wildberries" if marketplace == "wildberries" else "ozon"
        results = []
        for product in products:
            product = normalize_product_identifiers(dict(product), mp_key)
            offer_id = str(product.get("offer_id") or product.get("wb_sku") or "").strip()
            name = str(product.get("name") or "").strip()
            validation_errors = validate_product_for_import(product, mp_key)
            if validation_errors:
                results.append({"offer_id": offer_id, "ok": False, "error": " ".join(validation_errors[:3])})
                continue
            if not offer_id or not name:
                results.append({"offer_id": offer_id, "ok": False, "error": "Нужны артикул и название."})
                continue
            hist = MarketplaceProductHistory.objects.create(
                provider=provider,
                marketplace=mp_key,
                offer_id=offer_id,
                product_data=product,
                status="pending",
            )
            if s.environment != "prod":
                hist.status = "sandbox"
                hist.response = {"status": "sandbox", "message": "Песочница: запрос к API не отправлялся."}
                hist.save(update_fields=["status", "response"])
                results.append({"offer_id": offer_id, "ok": True, "sandbox": True, "id": hist.id})
                continue
            try:
                product = _prepare_product_for_marketplace(product)
                if marketplace == "wildberries":
                    payload = {"cards": [build_wb_card(product)]}
                    resp = request_json(
                        provider=provider,
                        marketplace="wb",
                        method="POST",
                        url=WB_ACTIONS["products.upload"][1],
                        headers=wb_headers(s),
                        json_body=payload,
                    )
                    hist.status = "success"
                    hist.response = resp
                    hist.save(update_fields=["status", "response"])
                    nm_id = fetch_wb_nm_id(provider, s, offer_id)
                    apply_import_identifiers_to_history(hist, "wildberries", nm_id=nm_id)
                    results.append(
                        {
                            "offer_id": offer_id,
                            "ok": True,
                            "id": hist.id,
                            "nm_id": nm_id,
                            "response": resp,
                        }
                    )
                else:
                    payload = {"items": [build_ozon_item(product)]}
                    resp = request_json(
                        provider=provider,
                        marketplace="ozon",
                        method="POST",
                        url=OZON_ACTIONS["products.import"][1],
                        headers=ozon_headers(s),
                        json_body=payload,
                    )
                    task_id = _extract_ozon_task_id(resp)
                    response_payload = dict(resp)
                    if task_id is not None:
                        response_payload["task_id"] = task_id
                        response_payload["import_status"] = "pending"
                    hist.status = "pending" if task_id is not None else "success"
                    hist.response = response_payload
                    hist.save(update_fields=["status", "response"])
                    results.append(
                        {
                            "offer_id": offer_id,
                            "ok": True,
                            "id": hist.id,
                            "task_id": task_id,
                            "response": resp,
                        }
                    )
            except MarketplaceError as exc:
                hist.status = "failed"
                hist.response = {"error": str(exc)}
                hist.save(update_fields=["status", "response"])
                results.append({"offer_id": offer_id, "ok": False, "error": str(exc)})
        ok = sum(1 for r in results if r.get("ok"))
        return Response({"total": len(results), "ok": ok, "results": results})


class MarketplaceCallView(APIView):
    """Универсальный вызов действия Ozon/WB. Тело: {marketplace, action, payload, params}."""

    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        marketplace = (data.get("marketplace") or "ozon").strip()
        action = (data.get("action") or "").strip()
        payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}
        extra = data.get("params") if isinstance(data.get("params"), dict) else {}
        s = _settings(provider)
        table = OZON_ACTIONS if marketplace == "ozon" else WB_ACTIONS
        if action not in table:
            return Response({"detail": f"Неизвестное действие: {action}"}, status=400)
        method, url_tmpl = table[action]
        url = resolve_url(url_tmpl, extra)
        try:
            if s.environment != "prod":
                return Response({"sandbox": True, "message": "Тестовый режим: запрос к площадке не отправлялся. Включите боевой режим в меню «Управление»."})
            headers = ozon_headers(s) if marketplace == "ozon" else wb_headers(s)
            use_json = method in ("POST", "PUT", "PATCH")
            json_body = payload if use_json else None
            if method in ("POST", "PUT") and not json_body:
                json_body = {}
            if method == "PATCH" and not payload:
                json_body = None
            result = request_json(
                provider=provider,
                marketplace=marketplace,
                method=method,
                url=url,
                headers=headers,
                json_body=json_body,
                params=payload if method == "GET" else (extra or None),
            )
            return Response(result)
        except MarketplaceError as exc:
            return Response({"detail": str(exc)}, status=min(exc.status_code, 599) if exc.status_code >= 400 else 400)


class MarketplaceMediaView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        upload = request.FILES.get("file") or request.FILES.get("image")
        if not upload:
            return Response({"detail": "Файл не передан."}, status=400)
        from django.core.files.storage import default_storage
        from io import BytesIO

        raw = upload.read()
        upload.seek(0)
        name = default_storage.save(f"marketplace/{provider.id}/{upload.name}", upload)
        url = _media_public_url(request, name)
        thumb_url = url
        s = _settings(provider)
        disk_url = None
        if not _is_video_upload(upload):
            try:
                disk_url = _upload_to_yandex_disk(s.yandex_disk_token, upload.name, BytesIO(raw))
            except Exception:
                logger.exception("yandex disk upload failed")
        public_url = (disk_url or url).strip()
        return Response(
            {
                "url": url,
                "public_url": public_url,
                "thumb_url": thumb_url,
                "disk_url": disk_url,
                "name": upload.name,
                "stored": "yandex_disk" if disk_url else "local",
            }
        )


class MarketplaceImportStatusView(APIView):
    """Ozon import task status (POST {task_id} or {history_id})."""

    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        history_id = data.get("history_id")
        task_id = data.get("task_id")
        hist = None
        if history_id:
            hist = MarketplaceProductHistory.objects.filter(provider=provider, id=history_id).first()
            if not hist:
                return Response({"detail": "Запись истории не найдена."}, status=404)
            task_id = task_id or (hist.response or {}).get("task_id")
        if not task_id:
            return Response({"detail": "Укажите task_id или history_id с задачей Ozon."}, status=400)
        s = _settings(provider)
        if s.environment != "prod":
            return Response({"sandbox": True, "message": "Статус импорта доступен в боевом режиме."})
        try:
            resp = request_json(
                provider=provider,
                marketplace="ozon",
                method="POST",
                url=OZON_ACTIONS["products.import_info"][1],
                headers=ozon_headers(s),
                json_body={"task_id": int(task_id)},
            )
        except MarketplaceError as exc:
            return Response({"detail": str(exc)}, status=min(exc.status_code, 599) if exc.status_code >= 400 else 400)
        summary = summarize_ozon_import_status(resp)
        if hist:
            merged = dict(hist.response or {})
            merged["task_id"] = int(task_id)
            merged["import_status"] = summary["status"]
            merged["import_items"] = summary["items"]
            err_bits = [r.get("errors") for r in summary["items"] if r.get("errors")]
            merged["import_errors"] = "; ".join(err_bits[:3])
            merged["import_info"] = resp
            hist.response = merged
            if summary["status"] == "success":
                hist.status = "success"
            elif summary["status"] == "failed":
                hist.status = "failed"
            else:
                hist.status = "pending"
            hist.save(update_fields=["status", "response"])
            apply_import_identifiers_to_history(hist, "ozon", summary_items=summary["items"])
        return Response(
            {
                "task_id": int(task_id),
                "history_id": hist.id if hist else None,
                "import_status": summary["status"],
                "items": summary["items"],
                "raw": resp,
            }
        )


class MarketplaceProductFetchView(APIView):
    """Load product card from marketplace for editing (POST {marketplace, offer_id})."""

    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        marketplace = (data.get("marketplace") or "ozon").strip()
        offer_id = str(data.get("offer_id") or "").strip()
        if not offer_id:
            return Response({"detail": "Укажите артикул (offer_id)."}, status=400)
        s = _settings(provider)
        if s.environment != "prod":
            return Response({"detail": "Загрузка с площадки доступна в боевом режиме."}, status=400)
        try:
            if marketplace == "wildberries":
                resp = request_json(
                    provider=provider,
                    marketplace="wb",
                    method="POST",
                    url=WB_ACTIONS["products.list"][1],
                    headers=wb_headers(s),
                    json_body={
                        "settings": {
                            "cursor": {"limit": 1},
                            "filter": {"textSearch": offer_id, "withPhoto": -1},
                        }
                    },
                )
                cards = resp.get("cards") or resp.get("data", {}).get("cards") or []
                card = cards[0] if cards else None
                if not card:
                    return Response({"detail": "Товар не найден на Wildberries."}, status=404)
                variant = (card.get("variants") or [{}])[0]
                media = variant.get("mediaFiles") or variant.get("photos") or []
                images = [{"url": u, "public_url": u} for u in media if isinstance(u, str) and u.startswith("http")]
                product = {
                    "offer_id": variant.get("vendorCode") or offer_id,
                    "vendor_code": variant.get("vendorCode") or offer_id,
                    "name": variant.get("title") or card.get("title") or "",
                    "brand": variant.get("brand") or card.get("brand") or "",
                    "price": str((variant.get("sizes") or [{}])[0].get("price") or ""),
                    "description": variant.get("description") or "",
                    "barcode": str((variant.get("sizes") or [{}])[0].get("skus") or [""])[0] or "",
                    "category": str(card.get("subjectID") or card.get("subjectId") or ""),
                    "type": "",
                    "characteristics": {},
                    "images": images,
                    "nm_id": card.get("nmID") or card.get("nmId"),
                }
            else:
                resp = request_json(
                    provider=provider,
                    marketplace="ozon",
                    method="POST",
                    url=OZON_ACTIONS["products.info"][1],
                    headers=ozon_headers(s),
                    json_body={"offer_id": [offer_id], "product_id": [], "sku": []},
                )
                items = resp.get("items") or (resp.get("result") or {}).get("items") or []
                if not items:
                    return Response({"detail": "Товар не найден на Ozon."}, status=404)
                product = parse_ozon_product_item(items[0])
            return Response({"product": product, "source": "marketplace"})
        except MarketplaceError as exc:
            return Response({"detail": str(exc)}, status=min(exc.status_code, 599) if exc.status_code >= 400 else 400)


class MarketplaceCatalogSyncView(APIView):
    """Pull cards from marketplace into local history (bidirectional catalog sync)."""

    def post(self, request):
        import time

        provider, err = _require_provider(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        marketplace = (data.get("marketplace") or "ozon").strip()
        mp_key = "wildberries" if marketplace == "wildberries" else "ozon"
        limit = max(1, min(int(data.get("limit") or 50), 100))
        s = _settings(provider)
        if s.environment != "prod":
            return Response({"detail": "Синхронизация каталога доступна в боевом режиме."}, status=400)

        created = 0
        updated = 0
        skipped = 0
        errors: list[str] = []
        try:
            products: list[dict] = []
            if mp_key == "wildberries":
                cursor = {"limit": limit}
                resp = request_json(
                    provider=provider,
                    marketplace="wb",
                    method="POST",
                    url=WB_ACTIONS["products.list"][1],
                    headers=wb_headers(s),
                    json_body={"settings": {"cursor": cursor, "filter": {"withPhoto": -1}}},
                )
                cards = resp.get("cards") or (resp.get("data") or {}).get("cards") or []
                for card in cards[:limit]:
                    if not isinstance(card, dict):
                        continue
                    variant = (card.get("variants") or [{}])[0] or {}
                    media = variant.get("mediaFiles") or variant.get("photos") or []
                    images = [{"url": u, "public_url": u} for u in media if isinstance(u, str) and u.startswith("http")]
                    offer = str(variant.get("vendorCode") or card.get("vendorCode") or "").strip()
                    if not offer:
                        skipped += 1
                        continue
                    products.append(
                        {
                            "offer_id": offer,
                            "vendor_code": offer,
                            "name": variant.get("title") or card.get("title") or offer,
                            "brand": variant.get("brand") or card.get("brand") or "",
                    "price": str((variant.get("sizes") or [{}])[0].get("price") or ""),
                    "description": variant.get("description") or "",
                    "barcode": str(((variant.get("sizes") or [{}])[0].get("skus") or [""])[0] or ""),
                    "category": str(card.get("subjectID") or card.get("subjectId") or ""),
                    "images": images,
                    "nm_id": card.get("nmID") or card.get("nmId"),
                        }
                    )
            else:
                last_id = ""
                offer_ids: list[str] = []
                product_ids: list[int] = []
                while len(offer_ids) < limit:
                    chunk = min(100, limit - len(offer_ids))
                    listing = request_json(
                        provider=provider,
                        marketplace="ozon",
                        method="POST",
                        url=OZON_ACTIONS["products.list"][1],
                        headers=ozon_headers(s),
                        json_body={"filter": {"visibility": "ALL"}, "last_id": last_id, "limit": chunk},
                    )
                    result = listing.get("result") if isinstance(listing.get("result"), dict) else listing
                    items = (result or {}).get("items") or []
                    if not items:
                        break
                    for it in items:
                        if not isinstance(it, dict):
                            continue
                        oid = str(it.get("offer_id") or "").strip()
                        pid = it.get("product_id")
                        if oid:
                            offer_ids.append(oid)
                        if pid is not None:
                            try:
                                product_ids.append(int(pid))
                            except (TypeError, ValueError):
                                pass
                    last_id = str((result or {}).get("last_id") or "")
                    if not last_id or len(items) < chunk:
                        break
                    time.sleep(0.6)
                # Enrich via info/list in batches
                for i in range(0, len(offer_ids), 100):
                    batch_offers = offer_ids[i : i + 100]
                    batch_pids = product_ids[i : i + 100]
                    info = request_json(
                        provider=provider,
                        marketplace="ozon",
                        method="POST",
                        url=OZON_ACTIONS["products.info"][1],
                        headers=ozon_headers(s),
                        json_body={"offer_id": batch_offers, "product_id": batch_pids, "sku": []},
                    )
                    info_items = info.get("items") or (info.get("result") or {}).get("items") or []
                    for item in info_items:
                        if isinstance(item, dict):
                            products.append(parse_ozon_product_item(item))
                    time.sleep(0.6)

            for product in products:
                product = normalize_product_identifiers(dict(product), mp_key)
                offer_id = str(product.get("offer_id") or "").strip()
                if not offer_id:
                    skipped += 1
                    continue
                existing = MarketplaceProductHistory.objects.filter(
                    provider=provider, marketplace=mp_key, offer_id=offer_id
                ).first()
                if existing:
                    existing.product_data = {**(existing.product_data or {}), **product}
                    existing.status = "synced"
                    existing.response = {"source": "catalog_sync"}
                    existing.save(update_fields=["product_data", "status", "response", "updated_at"])
                    updated += 1
                else:
                    MarketplaceProductHistory.objects.create(
                        provider=provider,
                        marketplace=mp_key,
                        offer_id=offer_id,
                        product_data=product,
                        status="synced",
                        response={"source": "catalog_sync"},
                    )
                    created += 1
        except MarketplaceError as exc:
            return Response({"detail": str(exc), "created": created, "updated": updated}, status=min(exc.status_code, 599) if exc.status_code >= 400 else 400)
        except Exception as exc:
            logger.exception("catalog sync failed")
            errors.append(str(exc)[:200])

        return Response(
            {
                "ok": True,
                "marketplace": mp_key,
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "total": created + updated,
                "errors": errors,
            }
        )


class MarketplaceDescribeView(APIView):
    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        open_key = (getattr(settings, "OPENROUTER_API_KEY", "") or "").strip()
        ollama_url = (getattr(settings, "OLLAMA_API_URL", "") or "").strip()
        ollama_model = (getattr(settings, "OLLAMA_MODEL", "") or "").strip()
        if not open_key and not (ollama_url and ollama_model):
            return Response(
                {"detail": "ИИ-описания на сервере не настроены. Укажите OPENROUTER_API_KEY или OLLAMA_MODEL/OLLAMA_API_URL."},
                status=503,
            )
        data = request.data if isinstance(request.data, dict) else {}
        name = str(data.get("product_name") or data.get("name") or "").strip()
        if not name:
            return Response({"detail": "Укажите название товара."}, status=400)
        brand = str(data.get("brand") or "").strip()
        category = str(data.get("category") or "").strip()
        features = data.get("key_features") or []
        marketplace = str(data.get("marketplace") or "ozon")
        prompt = (
            f"Напиши продающее описание товара для {marketplace} на русском, 600-1200 символов. "
            f"Товар: {name}. Бренд: {brand or 'не указан'}. Категория: {category or 'не указана'}. "
            f"Особенности: {', '.join(str(x) for x in features) if features else 'нет'}."
        )
        errors: list[str] = []
        if open_key:
            try:
                import requests

                resp = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {open_key}", "Content-Type": "application/json"},
                    json={
                        "model": getattr(settings, "OPENROUTER_MODEL", "") or "nvidia/nemotron-3-ultra-550b-a55b:free",
                        "messages": [{"role": "user", "content": prompt}],
                    },
                    timeout=90,
                    proxies=_openrouter_proxies(),
                )
                body = resp.json() if resp.content else {}
                text = (((body.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
                if text:
                    return Response({"description": _clean_ai_description(text)})
                err = body.get("error")
                if isinstance(err, dict):
                    err = err.get("message") or err.get("code") or str(err)
                errors.append(str(err or "Пустой ответ модели."))
            except Exception as exc:
                logger.exception("openrouter failed")
                errors.append(str(exc))

        if ollama_url and ollama_model:
            try:
                import requests

                resp = requests.post(
                    f"{ollama_url.rstrip('/')}/api/generate",
                    json={"model": ollama_model, "prompt": prompt, "stream": False},
                    timeout=120,
                )
                body = resp.json() if resp.content else {}
                text = (body.get("response") or body.get("message") or body.get("content") or "").strip()
                if text:
                    return Response({"description": _clean_ai_description(text)})
                errors.append(str(body.get("error") or body.get("errors") or "Пустой ответ Ollama."))
            except Exception as exc:
                logger.exception("ollama failed")
                errors.append(str(exc))

        return Response({"detail": errors[0] if errors else "Не удалось сгенерировать описание."}, status=502)


DISK_COOKIE = "vmeste_disk_oauth"
YANDEX_AUTHORIZE = "https://oauth.yandex.ru/authorize"
YANDEX_TOKEN = "https://oauth.yandex.ru/token"


def _disk_origin() -> str:
    return (getattr(settings, "FRONTEND_URL", None) or "https://vsevmeste.space").rstrip("/")


def _disk_callback_url() -> str:
    return f"{_disk_origin()}/api/marketplaces/yandex-disk/callback/"


def _disk_signer():
    from django.core.signing import TimestampSigner

    return TimestampSigner(salt="vmeste-yandex-disk")


class YandexDiskStartView(APIView):
    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        if not (settings.YANDEX_OAUTH_CLIENT_ID and settings.YANDEX_OAUTH_CLIENT_SECRET):
            return Response({"detail": "Яндекс OAuth на сервере не настроен."}, status=503)
        import json
        import secrets
        from urllib.parse import urlencode

        state = secrets.token_urlsafe(24)
        redirect_uri = _disk_callback_url()
        params = {
            "response_type": "code",
            "client_id": settings.YANDEX_OAUTH_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "state": state,
            "force_confirm": "yes",
            "scope": "cloud_api:disk.app_folder",
        }
        url = f"{YANDEX_AUTHORIZE}?{urlencode(params)}"
        payload = json.dumps({"uid": provider.id, "s": state, "r": redirect_uri}, separators=(",", ":"))
        response = Response({"authorize_url": url})
        response.set_cookie(
            DISK_COOKIE,
            _disk_signer().sign(payload),
            max_age=600,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            path="/",
        )
        return response


class YandexDiskCallbackView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        import json
        from urllib.parse import urlencode

        import requests
        from django.core.signing import BadSignature, SignatureExpired
        from django.http import HttpResponseRedirect

        origin = _disk_origin()
        fail = f"{origin}/marketplaces?{urlencode({'disk': 'error'})}"
        code = (request.GET.get("code") or "").strip()
        state = (request.GET.get("state") or "").strip()
        raw = request.COOKIES.get(DISK_COOKIE) or ""
        if not code or not raw:
            return HttpResponseRedirect(fail)
        try:
            bag = json.loads(_disk_signer().unsign(raw, max_age=600))
        except (BadSignature, SignatureExpired, json.JSONDecodeError, TypeError, ValueError):
            return HttpResponseRedirect(fail)
        if bag.get("s") != state:
            return HttpResponseRedirect(fail)
        try:
            token_res = requests.post(
                YANDEX_TOKEN,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": settings.YANDEX_OAUTH_CLIENT_ID,
                    "client_secret": settings.YANDEX_OAUTH_CLIENT_SECRET,
                },
                timeout=20,
            )
            token_data = token_res.json() if token_res.content else {}
            access = (token_data.get("access_token") or "").strip()
        except Exception:
            logger.exception("yandex disk token failed")
            return HttpResponseRedirect(fail)
        if not access:
            return HttpResponseRedirect(fail)
        user = User.objects.filter(pk=bag.get("uid"), role=User.Role.PROVIDER).first()
        if not user:
            return HttpResponseRedirect(fail)
        s = _settings(user)
        s.yandex_disk_token = access
        s.save(update_fields=["yandex_disk_token"])
        response = HttpResponseRedirect(f"{origin}/marketplaces?{urlencode({'disk': 'ok'})}")
        response.delete_cookie(DISK_COOKIE, path="/")
        return response


class MarketplaceLogsView(APIView):
    """Recent API call logs for the current marketplace provider."""

    def get(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        qs = MarketplaceApiLog.objects.filter(provider=provider)
        mp = (request.query_params.get("marketplace") or "").strip()
        if mp:
            qs = qs.filter(marketplace__icontains=mp)
        limit = min(int(request.query_params.get("limit") or 100), 300)
        rows = [
            {
                "id": row.id,
                "marketplace": row.marketplace,
                "endpoint": row.endpoint,
                "method": row.method,
                "status_code": row.status_code,
                "error_message": (row.error_message or "")[:400],
                "created_at": row.created_at.isoformat(),
            }
            for row in qs[:limit]
        ]
        return Response({"results": rows, "total": len(rows)})


class MarketplaceExportView(APIView):
    """Export product history as CSV or Excel (xlsx)."""

    def get(self, request):
        from django.http import HttpResponse

        provider, err = _require_provider(request)
        if err:
            return err
        # Prefer `export=` — DRF reserves `?format=` for content negotiation (404 if unknown).
        fmt = (
            request.query_params.get("export")
            or request.query_params.get("file")
            or request.query_params.get("fmt")
            or "csv"
        ).strip().lower()
        mp = (request.query_params.get("marketplace") or "").strip()
        qs = MarketplaceProductHistory.objects.filter(provider=provider)
        if mp:
            qs = qs.filter(marketplace=mp)
        headers = [
            "id",
            "marketplace",
            "offer_id",
            "vendor_code",
            "nm_id",
            "product_id",
            "name",
            "brand",
            "price",
            "stock",
            "status",
            "updated_at",
        ]
        rows = []
        for row in qs[:2000]:
            item = _history_item(row)
            product = item.get("product") or {}
            rows.append(
                [
                    item.get("id"),
                    item.get("marketplace"),
                    item.get("offer_id"),
                    item.get("vendor_code"),
                    item.get("nm_id"),
                    item.get("product_id"),
                    product.get("name"),
                    product.get("brand"),
                    product.get("price"),
                    product.get("stock"),
                    item.get("status"),
                    item.get("updated_at"),
                ]
            )
        if fmt in ("xlsx", "excel"):
            try:
                from openpyxl import Workbook
            except ImportError:
                fmt = "csv"
            else:
                wb = Workbook()
                ws = wb.active
                ws.title = "history"
                ws.append(headers)
                for r in rows:
                    ws.append(list(r))
                from io import BytesIO

                buf = BytesIO()
                wb.save(buf)
                resp = HttpResponse(
                    buf.getvalue(),
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                resp["Content-Disposition"] = 'attachment; filename="marketplace-history.xlsx"'
                return resp
        import csv
        from io import StringIO

        buf = StringIO()
        buf.write("\ufeff")
        writer = csv.writer(buf, delimiter=";")
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if v is None else v for v in r])
        resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="marketplace-history.csv"'
        return resp


class MarketplaceBarcodeView(APIView):
    """
    Generate barcodes.
    - Wildberries: {count}
    - Ozon for existing cards: {product_ids: [...]} (1–100) → API /v1/barcode/generate
    - New card without product_id: {local: true} → локальный EAN-13 (префикс 200)
    """

    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        marketplace = (data.get("marketplace") or "ozon").strip()
        count = max(1, min(int(data.get("count") or 1), 20))
        raw_ids = data.get("product_ids") or data.get("product_id") or []
        if raw_ids is not None and not isinstance(raw_ids, list):
            raw_ids = [raw_ids]
        product_ids = []
        for x in raw_ids or []:
            s = str(x).strip()
            if s and s not in product_ids:
                product_ids.append(s)
        product_ids = product_ids[:100]
        want_local = bool(data.get("local")) or (marketplace == "ozon" and not product_ids)

        if want_local or marketplace not in ("ozon", "wildberries"):
            codes = generate_local_ean13(count)
            return Response(
                {
                    "barcodes": codes,
                    "source": "local",
                    "message": "Локальный EAN-13 для новой карточки. На Ozon API нужны product_ids уже созданного товара.",
                }
            )

        s = _settings(provider)
        if s.environment != "prod":
            return Response(
                {
                    "sandbox": True,
                    "message": "Генерация на площадке доступна в боевом режиме. Для черновика используйте local.",
                    "barcodes": [],
                }
            )
        try:
            if marketplace == "wildberries":
                resp = request_json(
                    provider=provider,
                    marketplace="wb",
                    method="POST",
                    url=WB_ACTIONS["barcode.generate"][1],
                    headers=wb_headers(s),
                    json_body={"count": count},
                )
                barcodes = resp.get("data") or resp.get("barcodes") or []
                if isinstance(barcodes, dict):
                    barcodes = barcodes.get("barcodes") or []
                source = "wildberries"
            else:
                resp = request_json(
                    provider=provider,
                    marketplace="ozon",
                    method="POST",
                    url=OZON_ACTIONS["barcode.generate"][1],
                    headers=ozon_headers(s),
                    json_body={"product_ids": product_ids},
                )
                barcodes = []
                results = resp.get("result") if isinstance(resp.get("result"), list) else None
                if results is None and isinstance(resp.get("results"), list):
                    results = resp["results"]
                if isinstance(results, list):
                    for row in results:
                        if not isinstance(row, dict):
                            continue
                        for b in row.get("barcodes") or []:
                            if b:
                                barcodes.append(str(b))
                if not barcodes:
                    barcodes = resp.get("barcodes") or []
                errors = resp.get("errors") or []
                if errors and not barcodes:
                    first = errors[0] if isinstance(errors[0], dict) else {"error": errors[0]}
                    msg = first.get("error") or first.get("message") or str(first)
                    return Response({"detail": msg, "errors": errors, "raw": resp}, status=400)
                source = "ozon"
            if not isinstance(barcodes, list):
                barcodes = []
            barcodes = [str(b) for b in barcodes if b]
            return Response({"barcodes": barcodes, "source": source, "raw": resp})
        except MarketplaceError as exc:
            return Response({"detail": str(exc)}, status=min(exc.status_code, 599) if exc.status_code >= 400 else 400)


class MarketplaceOrderLabelView(APIView):
    """PDF этикетки Ozon FBS: POST {posting_numbers: [...]}."""

    def post(self, request):
        from django.http import HttpResponse

        provider, err = _require_provider(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        numbers = data.get("posting_numbers") or data.get("posting_number") or []
        if isinstance(numbers, str):
            numbers = [numbers]
        if not isinstance(numbers, list):
            numbers = []
        numbers = [str(n).strip() for n in numbers if str(n).strip()][:20]
        if not numbers:
            return Response({"detail": "Укажите posting_numbers."}, status=400)
        s = _settings(provider)
        if s.environment != "prod":
            return Response(
                {"sandbox": True, "message": "Печать этикеток доступна в боевом режиме."},
                status=400,
            )
        try:
            content, ctype = request_bytes(
                provider=provider,
                marketplace="ozon",
                method="POST",
                url=OZON_ACTIONS["orders.label"][1],
                headers=ozon_headers(s),
                json_body={"posting_number": numbers},
            )
            if "pdf" not in (ctype or "").lower() and content[:4] != b"%PDF":
                # Sometimes API wraps error as JSON with 200 — already handled by request_bytes on !ok
                text = content[:400].decode("utf-8", errors="replace")
                return Response({"detail": text or "Ozon не вернул PDF этикетки."}, status=400)
            resp = HttpResponse(content, content_type="application/pdf")
            name = numbers[0].replace("/", "-") if len(numbers) == 1 else "ozon-labels"
            resp["Content-Disposition"] = f'attachment; filename="{name}.pdf"'
            return resp
        except MarketplaceError as exc:
            return Response({"detail": str(exc)}, status=min(exc.status_code, 599) if exc.status_code >= 400 else 400)


class MarketplaceSyncView(APIView):
    """Trigger background sync of pending Ozon imports for current provider."""

    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        from .tasks import sync_provider_task

        async_result = sync_provider_task.delay(provider.id)
        if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
            return Response({"ok": True, "eager": True, "result": async_result.result})
        return Response({"ok": True, "task_id": async_result.id})


class MarketplaceWebhookView(APIView):
    """
    Inbound webhook to trigger sync.
    Auth: Authorization: Bearer <webhook_secret> or ?secret= / JSON {secret}.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        from .tasks import sync_provider_task

        data = request.data if isinstance(request.data, dict) else {}
        auth = request.headers.get("Authorization") or ""
        secret = ""
        if auth.lower().startswith("bearer "):
            secret = auth[7:].strip()
        secret = secret or str(request.query_params.get("secret") or data.get("secret") or "").strip()
        if not secret:
            return Response({"detail": "Укажите webhook secret."}, status=401)
        s = MarketplaceSettings.objects.filter(webhook_secret=secret).select_related("provider").first()
        if not s or not s.provider_id:
            return Response({"detail": "Неверный secret."}, status=403)
        async_result = sync_provider_task.delay(s.provider_id)
        return Response({"ok": True, "provider_id": s.provider_id, "task_id": getattr(async_result, "id", None)})
