from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DevicePushToken, InAppNotification


class HealthView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


class InAppNotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "Укажи ids (список чисел)."}, status=status.HTTP_400_BAD_REQUEST)
        InAppNotification.objects.filter(user=request.user, pk__in=ids).update(read=True)
        return Response({"ok": True})


class RegisterPushTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = str(request.data.get("token") or "").strip()
        platform = str(request.data.get("platform") or "android").strip().lower()
        if not token or len(token) < 20:
            return Response({"detail": "Нужен token."}, status=status.HTTP_400_BAD_REQUEST)
        if platform not in {c.value for c in DevicePushToken.Platform}:
            platform = DevicePushToken.Platform.ANDROID
        obj, _ = DevicePushToken.objects.update_or_create(
            token=token,
            defaults={"user": request.user, "platform": platform},
        )
        return Response({"ok": True, "id": obj.id})

    def delete(self, request):
        token = str(request.data.get("token") or "").strip()
        if token:
            DevicePushToken.objects.filter(user=request.user, token=token).delete()
        else:
            DevicePushToken.objects.filter(user=request.user).delete()
        return Response({"ok": True})


class TelegramLinkTokenView(APIView):
    """Client: get deep-link to bind Telegram chat via bot /start."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        import secrets

        from notifications.telegram_bot import client_deep_link, platform_bot_username

        user = request.user
        if not (user.telegram_link_token or "").strip():
            user.telegram_link_token = secrets.token_urlsafe(16)
            user.save(update_fields=["telegram_link_token"])
        deep = client_deep_link(user.telegram_link_token)
        bot_username = platform_bot_username()
        return Response(
            {
                "link_token": user.telegram_link_token,
                "telegram_chat_id": user.telegram_chat_id or "",
                "linked": bool((user.telegram_chat_id or "").strip()),
                "deep_link": deep,
                "bot_username": bot_username,
                "hint": (
                    f"Откройте @{bot_username} и нажмите Start по ссылке — привязка автоматическая. "
                    "Или отправьте /start без кода: бот пришлёт Chat ID."
                )
                if bot_username
                else "Укажите TELEGRAM_BOT_USERNAME на платформе.",
            }
        )

    def delete(self, request):
        user = request.user
        user.telegram_chat_id = ""
        user.save(update_fields=["telegram_chat_id"])
        return Response({"ok": True, "linked": False})


class TelegramWebhookView(APIView):
    """Telegram bot updates: /start, /chatid, org/client linking."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from .telegram_bot import handle_telegram_update

        update = request.data if isinstance(request.data, dict) else {}
        try:
            handle_telegram_update(update)
        except Exception:
            import logging

            logging.getLogger(__name__).exception("telegram webhook failed")
        return Response({"ok": True})
