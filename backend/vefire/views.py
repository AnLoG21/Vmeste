from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import user_can_vefire
from .models import AgentHeartbeat, CastRequest
from .serializers import CastCreateSerializer, CastRequestSerializer

# Ignore leftover casts that sat in the queue (stops surprise navigations on agent restart).
STALE_PENDING_SEC = 90


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
        cutoff = timezone.now() - timedelta(seconds=STALE_PENDING_SEC)
        CastRequest.objects.filter(
            user=request.user,
            status=CastRequest.STATUS_PENDING,
            created_at__lt=cutoff,
        ).update(
            status=CastRequest.STATUS_FAILED,
            finished_at=timezone.now(),
            error="stale",
        )
        # Stuck "claimed" without ack also shouldn't block UX forever.
        CastRequest.objects.filter(
            user=request.user,
            status=CastRequest.STATUS_CLAIMED,
            claimed_at__lt=cutoff,
        ).update(
            status=CastRequest.STATUS_FAILED,
            finished_at=timezone.now(),
            error="stale_claim",
        )
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
        ips = request.data.get("ips") or []
        if not isinstance(ips, list):
            ips = []
        defaults = {"ips": [str(x)[:64] for x in ips[:8]]}
        if remote_url.startswith("http://") or remote_url.startswith("https://"):
            defaults["remote_url"] = remote_url[:500]
        obj, _ = AgentHeartbeat.objects.update_or_create(user=request.user, defaults=defaults)
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
        frame_age = None
        if obj.frame_updated_at:
            frame_age = int((timezone.now() - obj.frame_updated_at).total_seconds())
        online = age < 45 or (frame_age is not None and frame_age < 8)
        return Response(
            {
                "agent": {
                    "remote_url": obj.remote_url,
                    "ips": obj.ips,
                    "updated_at": obj.updated_at,
                    "online": online,
                    "age_sec": int(age),
                    "has_frame": bool(obj.last_jpeg),
                    "frame_width": obj.frame_width,
                    "frame_height": obj.frame_height,
                    "frame_age_sec": frame_age,
                }
            }
        )


class AgentFrameView(VefireGateMixin, APIView):
    """Agent uploads JPEG frames; phone downloads them inside Vmeste (HTTPS)."""

    permission_classes = [IsAuthenticated]

    def get_parsers(self):
        from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

        return [MultiPartParser(), FormParser(), JSONParser()]

    def post(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        upload = request.FILES.get("frame")
        raw = upload.read() if upload else (request.body if request.body and request.body[:2] == b"\xff\xd8" else b"")
        if not raw:
            return Response({"detail": "empty frame"}, status=status.HTTP_400_BAD_REQUEST)
        # Cap ~400KB to protect DB
        if len(raw) > 450_000:
            return Response({"detail": "frame too large"}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        try:
            width = int(request.data.get("width") or request.META.get("HTTP_X_FRAME_WIDTH") or 1280)
            height = int(request.data.get("height") or request.META.get("HTTP_X_FRAME_HEIGHT") or 720)
        except (TypeError, ValueError):
            width, height = 1280, 720
        obj, _ = AgentHeartbeat.objects.get_or_create(user=request.user, defaults={"remote_url": ""})
        obj.last_jpeg = raw
        obj.frame_width = max(1, min(width, 3840))
        obj.frame_height = max(1, min(height, 2160))
        obj.frame_updated_at = timezone.now()
        obj.updated_at = timezone.now()
        obj.save(
            update_fields=["last_jpeg", "frame_width", "frame_height", "frame_updated_at", "updated_at"]
        )
        return Response({"ok": True, "bytes": len(raw)})

    def get(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        try:
            obj = AgentHeartbeat.objects.get(user=request.user)
        except AgentHeartbeat.DoesNotExist:
            return HttpResponse(status=404)
        if not obj.last_jpeg:
            return HttpResponse(status=404)
        resp = HttpResponse(bytes(obj.last_jpeg), content_type="image/jpeg")
        resp["Cache-Control"] = "no-store"
        resp["X-Frame-Width"] = str(obj.frame_width)
        resp["X-Frame-Height"] = str(obj.frame_height)
        resp["Access-Control-Expose-Headers"] = "X-Frame-Width, X-Frame-Height"
        return resp


class AgentInputView(VefireGateMixin, APIView):
    """Phone enqueues input; agent drains the queue."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        event = request.data if isinstance(request.data, dict) else {}
        if not event.get("type"):
            return Response({"detail": "type required"}, status=status.HTTP_400_BAD_REQUEST)
        obj, _ = AgentHeartbeat.objects.get_or_create(user=request.user, defaults={"remote_url": ""})
        payload = dict(event)
        payload["_ts"] = timezone.now().timestamp()
        queue = list(obj.input_queue or [])
        queue.append(payload)
        obj.input_queue = queue[-80:]
        obj.save(update_fields=["input_queue", "updated_at"])
        return Response({"ok": True, "queued": len(obj.input_queue)})

    def get(self, request):
        denied = self.deny_if_not_allowed(request)
        if denied:
            return denied
        from django.db import transaction

        with transaction.atomic():
            try:
                obj = AgentHeartbeat.objects.select_for_update().get(user=request.user)
            except AgentHeartbeat.DoesNotExist:
                return Response({"events": []})
            now_ts = timezone.now().timestamp()
            # Drop events older than 8s so offline backlog doesn't spam the TV.
            events = []
            for ev in list(obj.input_queue or []):
                if not isinstance(ev, dict):
                    continue
                ts = float(ev.get("_ts") or 0)
                if ts and (now_ts - ts) > 8:
                    continue
                clean = {k: v for k, v in ev.items() if k != "_ts"}
                events.append(clean)
            obj.input_queue = []
            obj.save(update_fields=["input_queue", "updated_at"])
        return Response({"events": events})


