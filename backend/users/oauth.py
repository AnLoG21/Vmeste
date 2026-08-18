"""Yandex ID and VK ID (VK / OK / Mail) OAuth: start, callback, JWT."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
import secrets
from urllib.parse import parse_qs, urlencode, urlparse

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import permissions
from rest_framework.views import APIView

from .legal_versions import OFFER_VERSION, PRIVACY_VERSION
from .serializers import _client_ip, _client_ua

User = get_user_model()
logger = logging.getLogger(__name__)

OAUTH_COOKIE = "vmeste_oauth"
OAUTH_MAX_AGE = 600
REQUEST_TIMEOUT = 15

YANDEX_AUTHORIZE = "https://oauth.yandex.ru/authorize"
YANDEX_TOKEN = "https://oauth.yandex.ru/token"
YANDEX_INFO = "https://login.yandex.ru/info"

VK_AUTHORIZE = "https://id.vk.ru/authorize"
VK_TOKEN = "https://id.vk.ru/oauth2/auth"
VK_USER_INFO = "https://id.vk.ru/oauth2/user_info"


def _origin() -> str:
    return (getattr(settings, "FRONTEND_URL", None) or "https://vsevmeste.space").rstrip("/")


def _callback_url(provider: str) -> str:
    return f"{_origin()}/api/users/auth/{provider}/callback/"


def _signer() -> TimestampSigner:
    return TimestampSigner(salt="vmeste-oauth")


def _oauth_enabled(provider: str) -> bool:
    if provider == "yandex":
        return bool(settings.YANDEX_OAUTH_CLIENT_ID and settings.YANDEX_OAUTH_CLIENT_SECRET)
    if provider == "vk":
        return bool(settings.VK_OAUTH_CLIENT_ID and settings.VK_OAUTH_CLIENT_SECRET)
    return False


def _redirect_home(*, access: str = "", refresh: str = "", error: str = "") -> HttpResponseRedirect:
    origin = _origin()
    if error:
        return HttpResponseRedirect(f"{origin}/?{urlencode({'oauth_error': error})}")
    fragment = urlencode({"oauth_access": access, "oauth_refresh": refresh})
    return HttpResponseRedirect(f"{origin}/#{fragment}")


def _set_oauth_cookie(response, payload: dict) -> None:
    signed = _signer().sign(json.dumps(payload, separators=(",", ":")))
    response.set_cookie(
        OAUTH_COOKIE,
        signed,
        max_age=OAUTH_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        path="/",
    )


def _read_oauth_cookie(request) -> dict | None:
    raw = request.COOKIES.get(OAUTH_COOKIE) or ""
    if not raw:
        return None
    try:
        data = json.loads(_signer().unsign(raw, max_age=OAUTH_MAX_AGE))
    except (BadSignature, SignatureExpired, json.JSONDecodeError, TypeError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _clear_oauth_cookie(response) -> None:
    response.delete_cookie(OAUTH_COOKIE, path="/")


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    if len(verifier) > 128:
        verifier = verifier[:128]
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def _unique_username(prefix: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_]+", "_", (prefix or "").strip()).strip("_")[:40] or "user"
    username = base
    n = 1
    while User.objects.filter(username__iexact=username).exists():
        n += 1
        username = f"{base[:36]}_{n}"
    return username


def _issue_tokens(user) -> HttpResponseRedirect:
    from rest_framework_simplejwt.tokens import RefreshToken

    if not getattr(user, "is_active", False) or getattr(user, "account_deleted_at", None):
        return _redirect_home(error="Этот аккаунт удалён. Зарегистрируйтесь заново.")
    refresh = RefreshToken.for_user(user)
    response = _redirect_home(access=str(refresh.access_token), refresh=str(refresh))
    _clear_oauth_cookie(response)
    return response


def _intended_role(raw) -> str:
    role = str(raw or "").strip().lower()
    if role == User.Role.PROVIDER:
        return User.Role.PROVIDER
    return User.Role.CLIENT


def _detach_stale_oauth_ids(id_field: str, oauth_id: str) -> None:
    """Снять VK/Яндекс с удалённых и выключенных аккаунтов, чтобы можно было зарегистрироваться заново."""
    User.objects.filter(**{id_field: oauth_id}).exclude(is_active=True, account_deleted_at__isnull=True).update(
        **{id_field: ""}
    )


def _find_or_create_oauth_user(
    *,
    request,
    id_field: str,
    oauth_id: str,
    email: str,
    first_name: str,
    last_name: str,
    phone: str,
    username_hint: str,
    role: str = "",
) -> User:
    oauth_id = str(oauth_id or "").strip()
    email = (email or "").strip().lower()
    first_name = (first_name or "").strip()[:150]
    last_name = (last_name or "").strip()[:150]
    phone = re.sub(r"[^\d+]", "", phone or "")[:30]
    intended_role = _intended_role(role)

    _detach_stale_oauth_ids(id_field, oauth_id)
    live = {"is_active": True, "account_deleted_at__isnull": True}
    user = User.objects.filter(**{id_field: oauth_id}, **live).first()
    if not user and email:
        user = User.objects.filter(email__iexact=email, **live).first()
        if user:
            setattr(user, id_field, oauth_id)

    if user:
        changed = [id_field]
        if intended_role == User.Role.PROVIDER and user.role == User.Role.CLIENT:
            user.role = User.Role.PROVIDER
            changed.append("role")
        if email and not (user.email or "").strip():
            user.email = email
            user.email_verified = True
            changed.extend(["email", "email_verified"])
        elif email and (user.email or "").strip().lower() == email:
            if not user.email_verified:
                user.email_verified = True
                changed.append("email_verified")
        if first_name and not (user.first_name or "").strip():
            user.first_name = first_name
            changed.append("first_name")
        if last_name and not (user.last_name or "").strip():
            user.last_name = last_name
            changed.append("last_name")
        if phone and not (user.phone or "").strip():
            user.phone = phone
            changed.append("phone")
        user.save(update_fields=list(dict.fromkeys(changed)))
        return user

    now = timezone.now()
    user = User(
        username=_unique_username(username_hint or f"user_{oauth_id}"),
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        role=intended_role,
        email_verified=bool(email),
        consent_privacy_at=now,
        consent_offer_at=now,
        age_confirmed_at=now,
        consent_privacy_version=PRIVACY_VERSION,
        consent_offer_version=OFFER_VERSION,
        consent_ip=_client_ip(request),
        consent_user_agent=_client_ua(request),
    )
    setattr(user, id_field, oauth_id)
    user.set_unusable_password()
    user.save()
    return user


class YandexOAuthStartView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not _oauth_enabled("yandex"):
            return _redirect_home(error="Вход через Яндекс пока не настроен.")
        state = secrets.token_urlsafe(32)
        redirect_uri = _callback_url("yandex")
        params = {
            "response_type": "code",
            "client_id": settings.YANDEX_OAUTH_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "state": state,
            "force_confirm": "yes",
        }
        response = HttpResponseRedirect(f"{YANDEX_AUTHORIZE}?{urlencode(params)}")
        _set_oauth_cookie(
            response,
            {"p": "yandex", "s": state, "r": redirect_uri, "role": _intended_role(request.query_params.get("role"))},
        )
        return response


class YandexOAuthCallbackView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if request.GET.get("error"):
            return _redirect_home(error="Вход через Яндекс отменён.")
        code = (request.GET.get("code") or "").strip()
        state = (request.GET.get("state") or "").strip()
        bag = _read_oauth_cookie(request)
        if not code or not bag or bag.get("p") != "yandex" or bag.get("s") != state:
            return _redirect_home(error="Сессия входа через Яндекс истекла. Попробуйте ещё раз.")
        try:
            token_res = requests.post(
                YANDEX_TOKEN,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": settings.YANDEX_OAUTH_CLIENT_ID,
                    "client_secret": settings.YANDEX_OAUTH_CLIENT_SECRET,
                },
                timeout=REQUEST_TIMEOUT,
            )
            token_data = token_res.json() if token_res.content else {}
            access = (token_data.get("access_token") or "").strip()
            if token_res.status_code >= 400 or not access:
                logger.warning("yandex token exchange failed status=%s", token_res.status_code)
                return _redirect_home(error="Яндекс не выдал доступ. Проверьте Redirect URI в кабинете.")
            info_res = requests.get(
                YANDEX_INFO,
                params={"format": "json"},
                headers={"Authorization": f"OAuth {access}"},
                timeout=REQUEST_TIMEOUT,
            )
            info = info_res.json() if info_res.content else {}
        except (requests.RequestException, ValueError, TypeError):
            logger.exception("yandex oauth request failed")
            return _redirect_home(error="Не удалось связаться с Яндекс ID.")
        yandex_id = str(info.get("id") or "").strip()
        if not yandex_id:
            return _redirect_home(error="Яндекс не вернул профиль.")
        emails = info.get("emails") if isinstance(info.get("emails"), list) else []
        email = (info.get("default_email") or (emails[0] if emails else "") or "").strip()
        phone_obj = info.get("default_phone") if isinstance(info.get("default_phone"), dict) else {}
        user = _find_or_create_oauth_user(
            request=request,
            id_field="yandex_id",
            oauth_id=yandex_id,
            email=email,
            first_name=(info.get("first_name") or "").strip(),
            last_name=(info.get("last_name") or "").strip(),
            phone=str(phone_obj.get("number") or ""),
            username_hint=(info.get("login") or f"ya_{yandex_id}"),
            role=bag.get("role") or "",
        )
        return _issue_tokens(user)


def _vk_callback_payload(request) -> dict:
    payload_raw = (request.GET.get("payload") or "").strip()
    if payload_raw:
        try:
            data = json.loads(payload_raw)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            decoded = parse_qs(urlparse("?" + payload_raw).query)
            if decoded:
                return {k: v[0] if v else "" for k, v in decoded.items()}
    return {
        "code": (request.GET.get("code") or "").strip(),
        "state": (request.GET.get("state") or "").strip(),
        "device_id": (request.GET.get("device_id") or "").strip(),
    }


class VkOAuthStartView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not _oauth_enabled("vk"):
            return _redirect_home(error="Вход через VK ID пока не настроен.")
        state = secrets.token_urlsafe(32)
        verifier, challenge = _pkce_pair()
        redirect_uri = _callback_url("vk")
        params = {
            "response_type": "code",
            "client_id": settings.VK_OAUTH_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "scope": "email phone",
            "lang_id": "0",
        }
        response = HttpResponseRedirect(f"{VK_AUTHORIZE}?{urlencode(params)}")
        _set_oauth_cookie(
            response,
            {
                "p": "vk",
                "s": state,
                "v": verifier,
                "r": redirect_uri,
                "role": _intended_role(request.query_params.get("role")),
            },
        )
        return response


class VkOAuthCallbackView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if request.GET.get("error"):
            return _redirect_home(error="Вход через VK ID отменён.")
        payload = _vk_callback_payload(request)
        code = str(payload.get("code") or "").strip()
        state = str(payload.get("state") or "").strip()
        device_id = str(payload.get("device_id") or "").strip()
        bag = _read_oauth_cookie(request)
        if not code or not bag or bag.get("p") != "vk" or bag.get("s") != state:
            return _redirect_home(error="Сессия входа через VK ID истекла. Попробуйте ещё раз.")
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": bag.get("v") or "",
            "client_id": settings.VK_OAUTH_CLIENT_ID,
            "redirect_uri": bag.get("r") or _callback_url("vk"),
            "device_id": device_id,
            "state": state,
            "service_token": settings.VK_OAUTH_CLIENT_SECRET,
        }
        try:
            token_res = requests.post(VK_TOKEN, data=data, timeout=REQUEST_TIMEOUT)
            token_data = token_res.json() if token_res.content else {}
            access = (token_data.get("access_token") or "").strip()
            if token_res.status_code >= 400 or not access:
                logger.warning("vk token exchange failed status=%s body=%s", token_res.status_code, token_res.text[:300])
                return _redirect_home(error="VK ID не выдал доступ. Проверьте Redirect URI и способы входа в кабинете.")
            info_res = requests.post(
                VK_USER_INFO,
                data={
                    "access_token": access,
                    "client_id": settings.VK_OAUTH_CLIENT_ID,
                },
                timeout=REQUEST_TIMEOUT,
            )
            info_wrap = info_res.json() if info_res.content else {}
            info = info_wrap.get("user") if isinstance(info_wrap.get("user"), dict) else {}
        except (requests.RequestException, ValueError, TypeError):
            logger.exception("vk oauth request failed")
            return _redirect_home(error="Не удалось связаться с VK ID.")
        vk_id = str(info.get("user_id") or token_data.get("user_id") or "").strip()
        if not vk_id:
            return _redirect_home(error="VK ID не вернул профиль.")
        user = _find_or_create_oauth_user(
            request=request,
            id_field="vk_id",
            oauth_id=vk_id,
            email=(info.get("email") or "").strip(),
            first_name=(info.get("first_name") or "").strip(),
            last_name=(info.get("last_name") or "").strip(),
            phone=str(info.get("phone") or ""),
            username_hint=f"vk_{vk_id}",
            role=bag.get("role") or "",
        )
        return _issue_tokens(user)
