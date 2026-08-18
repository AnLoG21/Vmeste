from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .clients import (
    MarketplaceError,
    OZON_ACTIONS,
    WB_ACTIONS,
    build_ozon_item,
    build_wb_card,
    ozon_headers,
    request_json,
    resolve_url,
    wb_headers,
)
from .models import MarketplaceProductHistory, MarketplaceSettings, MarketplaceTemplate

User = get_user_model()
logger = logging.getLogger(__name__)


def _provider(user):
    if not user or not user.is_authenticated:
        return None
    if getattr(user, "role", None) != User.Role.PROVIDER:
        return None
    if getattr(user, "provider_sphere", "") != User.ProviderSphere.MARKETPLACES:
        return None
    return user


def _require_provider(request):
    provider = _provider(request.user)
    if not provider:
        return None, Response({"detail": "Кабинет маркетплейсов доступен только исполнителям этой сферы."}, status=403)
    return provider, None


def _settings(provider) -> MarketplaceSettings:
    obj, _ = MarketplaceSettings.objects.get_or_create(provider=provider)
    return obj


class MarketplaceSettingsView(APIView):
    def get(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        s = _settings(provider)
        return Response(
            {
                "environment": s.environment,
                "ozon_client_id": s.ozon_client_id,
                "has_ozon_api_key": s.has_ozon(),
                "has_wb_api_key": s.has_wb(),
                "video_enabled": bool(getattr(settings, "MARKETPLACE_VIDEO_ENABLED", False)),
                "ai_enabled": bool((getattr(settings, "OPENROUTER_API_KEY", "") or "").strip()),
            }
        )

    def patch(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        s = _settings(provider)
        data = request.data if isinstance(request.data, dict) else {}
        env = (data.get("environment") or s.environment or "sandbox").strip()
        if env in ("sandbox", "prod"):
            s.environment = env
        if "ozon_client_id" in data:
            s.ozon_client_id = str(data.get("ozon_client_id") or "").strip()
        key = str(data.get("ozon_api_key") or "").strip()
        if key and not key.startswith("•"):
            s.ozon_api_key = key
        wb = str(data.get("wb_api_key") or "").strip()
        if wb and not wb.startswith("•"):
            s.wb_api_key = wb
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
            items.append(
                {
                    "id": row.id,
                    "marketplace": row.marketplace,
                    "offer_id": row.offer_id,
                    "product": row.product_data,
                    "status": row.status,
                    "response": row.response,
                    "updated_at": row.updated_at.isoformat(),
                }
            )
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


class MarketplaceImportView(APIView):
    def post(self, request):
        provider, err = _require_provider(request)
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
        results = []
        for product in products:
            offer_id = str(product.get("offer_id") or product.get("wb_sku") or "").strip()
            name = str(product.get("name") or "").strip()
            if not offer_id or not name:
                results.append({"offer_id": offer_id, "ok": False, "error": "Нужны артикул и название."})
                continue
            hist = MarketplaceProductHistory.objects.create(
                provider=provider,
                marketplace="wildberries" if marketplace == "wildberries" else "ozon",
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
                hist.status = "success"
                hist.response = resp
                hist.save(update_fields=["status", "response"])
                results.append({"offer_id": offer_id, "ok": True, "id": hist.id, "response": resp})
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
                return Response(
                    {
                        "sandbox": True,
                        "message": "Песочница: запрос к Ozon/WB не отправлялся.",
                        "would_call": {"method": method, "url": url, "action": action, "payload": payload, "params": extra},
                    }
                )
            headers = ozon_headers(s) if marketplace == "ozon" else wb_headers(s)
            result = request_json(
                provider=provider,
                marketplace=marketplace,
                method=method,
                url=url,
                headers=headers,
                json_body=payload if method in ("POST", "PUT", "PATCH") else None,
                params=payload if method == "GET" else extra or None,
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

        name = default_storage.save(f"marketplace/{provider.id}/{upload.name}", upload)
        url = request.build_absolute_uri(default_storage.url(name))
        return Response({"url": url, "name": name})


class MarketplaceDescribeView(APIView):
    def post(self, request):
        provider, err = _require_provider(request)
        if err:
            return err
        key = (getattr(settings, "OPENROUTER_API_KEY", "") or "").strip()
        if not key:
            return Response({"detail": "ИИ-описания на сервере не настроены."}, status=503)
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
        try:
            import requests

            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": "mistralai/mistral-7b-instruct:free",
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=40,
            )
            body = resp.json() if resp.content else {}
            text = (((body.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
            if not text:
                return Response({"detail": body.get("error") or "Пустой ответ модели."}, status=502)
            return Response({"description": text.strip()})
        except Exception as exc:
            logger.exception("openrouter failed")
            return Response({"detail": str(exc)}, status=502)
