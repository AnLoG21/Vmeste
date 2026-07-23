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
