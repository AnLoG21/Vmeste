from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InAppNotification


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
