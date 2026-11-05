from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import user_can_vefire
from .models import AgentHeartbeat, CastRequest
from .serializers import CastCreateSerializer, CastRequestSerializer


class VefireGateMixin:
    def deny_if_not_allowed(self, request):
        if not user_can_vefire(request.user):
            return Response({"detail": "Вэфире недоступен для этого аккаунта."}, status=status.HTTP_403_FORBIDDEN)
        return None


class CastCreateView(VefireGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        ser = CastCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        # Keep only one pending job — latest wins (TV remote feel).
        CastRequest.objects.filter(user=request.user, status=CastRequest.STATUS_PENDING).update(
            status=CastRequest.STATUS_DONE,
            finished_at=timezone.now(),
            error="superseded",
        )
        job = CastRequest.objects.create(
            user=request.user,
            url=ser.validated_data["url"],
            title=(ser.validated_data.get("title") or "")[:200],
        )
        return Response(CastRequestSerializer(job).data, status=status.HTTP_201_CREATED)


class CastNextView(VefireGateMixin, APIView):
    """Agent polls this to claim the next pending cast for the signed-in user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        job = (
            CastRequest.objects.filter(user=request.user, status=CastRequest.STATUS_PENDING)
            .order_by("created_at")
            .first()
        )
        if not job:
            return Response({"job": None})
        job.status = CastRequest.STATUS_CLAIMED
        job.claimed_at = timezone.now()
        job.save(update_fields=["status", "claimed_at", "updated_at"])
        return Response({"job": CastRequestSerializer(job).data})


class CastAckView(VefireGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        try:
            job = CastRequest.objects.get(pk=pk, user=request.user)
        except CastRequest.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        ok = bool(request.data.get("ok", True))
        job.status = CastRequest.STATUS_DONE if ok else CastRequest.STATUS_FAILED
        job.error = "" if ok else str(request.data.get("error") or "failed")[:500]
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "error", "finished_at", "updated_at"])
        return Response(CastRequestSerializer(job).data)


class CastLatestView(VefireGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        job = CastRequest.objects.filter(user=request.user).order_by("-created_at").first()
        return Response({"job": CastRequestSerializer(job).data if job else None})


class AgentHeartbeatView(VefireGateMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        remote_url = str(request.data.get("remote_url") or "").strip()
        if not remote_url.startswith("http://") and not remote_url.startswith("https://"):
            return Response({"detail": "remote_url required"}, status=status.HTTP_400_BAD_REQUEST)
        ips = request.data.get("ips") or []
        if not isinstance(ips, list):
            ips = []
        obj, _ = AgentHeartbeat.objects.update_or_create(
            user=request.user,
            defaults={"remote_url": remote_url[:500], "ips": [str(x)[:64] for x in ips[:8]]},
        )
        return Response({"remote_url": obj.remote_url, "updated_at": obj.updated_at, "ips": obj.ips})

    def get(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        try:
            obj = AgentHeartbeat.objects.get(user=request.user)
        except AgentHeartbeat.DoesNotExist:
            return Response({"agent": None})
        age = (timezone.now() - obj.updated_at).total_seconds()
        online = age < 45
        return Response(
            {
                "agent": {
                    "remote_url": obj.remote_url,
                    "ips": obj.ips,
                    "updated_at": obj.updated_at,
                    "online": online,
                    "age_sec": int(age),
                }
            }
        )

