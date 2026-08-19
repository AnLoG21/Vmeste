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


def _require_provider(request):
    provider = _provider(request.user)
    if not provider:
        return None, Response({"detail": "Кабинет маркетплейсов доступен только исполнителям этой сферы."}, status=403)
    return provider, None


def _settings(provider) -> MarketplaceSettings:
    obj, _ = MarketplaceSettings.objects.get_or_create(provider=provider)
    return obj


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
        return Response(
            {
                "environment": s.environment,
                "ozon_client_id": s.ozon_client_id,
                "has_ozon_api_key": s.has_ozon(),
                "has_wb_api_key": s.has_wb(),
                "has_yandex_disk": bool((s.yandex_disk_token or "").strip()),
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
        if "yandex_disk_token" in data:
            disk = str(data.get("yandex_disk_token") or "").strip()
            if disk == "":
                s.yandex_disk_token = ""
            elif not disk.startswith("•"):
                s.yandex_disk_token = disk
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
                return Response({"sandbox": True, "message": "Песочница: запрос к площадке не отправлялся. Включите боевой режим в меню «Управление»."})
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
        from io import BytesIO

        raw = upload.read()
        upload.seek(0)
        name = default_storage.save(f"marketplace/{provider.id}/{upload.name}", upload)
        url = _media_public_url(request, name)
        thumb_url = url
        if not _is_video_upload(upload):
            from common.image_processing import process_image_file

            thumb_name = process_image_file(name)
            if thumb_name:
                thumb_url = _media_public_url(request, thumb_name)
        s = _settings(provider)
        disk_url = None
        if not _is_video_upload(upload):
            try:
                disk_url = _upload_to_yandex_disk(s.yandex_disk_token, upload.name, BytesIO(raw))
            except Exception:
                logger.exception("yandex disk upload failed")
        return Response(
            {
                "url": url,
                "thumb_url": thumb_url,
                "disk_url": disk_url,
                "name": upload.name,
                "stored": "yandex_disk" if disk_url else "local",
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
