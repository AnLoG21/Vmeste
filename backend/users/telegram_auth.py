"""Telegram Login Widget: verify hash and issue JWT."""

from __future__ import annotations

import hashlib
import hmac
import time

from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.telegram_bot import platform_bot_token, platform_bot_username

User = get_user_model()


def _verify_telegram_auth(payload: dict, bot_token: str) -> bool:
    received = str(payload.get("hash") or "")
    if not received or not bot_token:
        return False
    pairs = []
    for key in sorted(payload.keys()):
        if key == "hash":
            continue
        val = payload.get(key)
        if val is None or val == "":
            continue
        pairs.append(f"{key}={val}")
    data_check = "\n".join(pairs)
    secret = hashlib.sha256(bot_token.encode("utf-8")).digest()
    digest = hmac.new(secret, data_check.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(digest, received):
        return False
    try:
        auth_date = int(payload.get("auth_date") or 0)
    except (TypeError, ValueError):
        return False
    if abs(time.time() - auth_date) > 86400:
        return False
    return True


class AuthProvidersView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        username = platform_bot_username()
        return Response(
            {
                "telegram": username or "",
                "yandex": False,
                "vk": False,
                "google": False,
            }
        )


class TelegramLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = platform_bot_token()
        data = request.data if isinstance(request.data, dict) else {}
        payload = {
            "id": data.get("id"),
            "first_name": data.get("first_name") or "",
            "last_name": data.get("last_name") or "",
            "username": data.get("username") or "",
            "photo_url": data.get("photo_url") or "",
            "auth_date": data.get("auth_date"),
            "hash": data.get("hash") or "",
        }
        if not token or not _verify_telegram_auth(payload, token):
            return Response({"detail": "Не удалось подтвердить вход через Telegram."}, status=status.HTTP_400_BAD_REQUEST)
        tg_id = str(payload.get("id") or "").strip()
        if not tg_id:
            return Response({"detail": "Нет Chat ID."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(telegram_chat_id=tg_id).first()
        if not user:
            login = (payload.get("username") or "").strip() or f"tg_{tg_id}"
            base = login[:40]
            username = base
            n = 1
            while User.objects.filter(username__iexact=username).exists():
                n += 1
                username = f"{base[:36]}_{n}"
            first = (payload.get("first_name") or "").strip()[:150] or "Telegram"
            last = (payload.get("last_name") or "").strip()[:150]
            user = User(
                username=username,
                first_name=first,
                last_name=last,
                role=User.Role.CLIENT,
                email_verified=True,
                telegram_chat_id=tg_id,
            )
            user.set_unusable_password()
            user.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        )
