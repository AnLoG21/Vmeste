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

        from django.conf import settings

        user = request.user
        if not (user.telegram_link_token or "").strip():
            user.telegram_link_token = secrets.token_urlsafe(16)
            user.save(update_fields=["telegram_link_token"])
        bot_username = (getattr(settings, "TELEGRAM_BOT_USERNAME", None) or "").strip()
        deep = f"https://t.me/{bot_username}?start={user.telegram_link_token}" if bot_username else ""
        return Response(
            {
                "link_token": user.telegram_link_token,
                "telegram_chat_id": user.telegram_chat_id or "",
                "linked": bool((user.telegram_chat_id or "").strip()),
                "deep_link": deep,
                "hint": "Откройте бота и отправьте /start с кодом, либо перейдите по deep_link.",
            }
        )

    def delete(self, request):
        user = request.user
        user.telegram_chat_id = ""
        user.save(update_fields=["telegram_chat_id"])
        return Response({"ok": True, "linked": False})


class TelegramWebhookView(APIView):
    """Telegram bot updates: /start <link_token> binds chat_id to user."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from users.models import User

        from .channels import send_telegram

        update = request.data if isinstance(request.data, dict) else {}
        message = update.get("message") or update.get("edited_message") or {}
        chat = message.get("chat") or {}
        chat_id = str(chat.get("id") or "")
        text = str(message.get("text") or "").strip()
        if not chat_id or not text.startswith("/start"):
            return Response({"ok": True})
        parts = text.split(maxsplit=1)
        token = (parts[1] if len(parts) > 1 else "").strip()
        if not token:
            return Response({"ok": True})
        user = User.objects.filter(telegram_link_token=token).first()
        if not user:
            return Response({"ok": True})
        user.telegram_chat_id = chat_id
        user.save(update_fields=["telegram_chat_id"])
        from django.conf import settings as dj_settings

        from booking.models import ProviderMessagingSettings

        token = (getattr(dj_settings, "TELEGRAM_BOT_TOKEN", None) or "").strip()
        if not token:
            bot = (
                ProviderMessagingSettings.objects.filter(enable_telegram=True)
                .exclude(telegram_bot_token="")
                .first()
            )
            token = (bot.telegram_bot_token if bot else "") or ""
        if token:
            send_telegram(
                bot_token=token,
                chat_id=chat_id,
                text="Telegram привязан к аккаунту Вместе. Вы будете получать напоминания о записях.",
            )
        return Response({"ok": True})
