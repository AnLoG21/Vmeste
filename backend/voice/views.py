import re

from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User

from .models import ProviderVoiceSettings, VoiceCallSession, VoiceCallTurn
from .outbound import pending_confirmation_bookings
from .orchestrator import close_session, get_or_create_session, process_turn
from .telephony import normalize_inbound


def _digits(phone: str) -> str:
    return re.sub(r"\D+", "", phone or "")


def _resolve_voice_settings(request) -> ProviderVoiceSettings | None:
    token = (request.headers.get("X-Voice-Token") or request.query_params.get("token") or "").strip()
    if not token:
        data = request.data if isinstance(request.data, dict) else {}
        token = (data.get("webhook_token") or data.get("token") or "").strip()
    if not token:
        return None
    return ProviderVoiceSettings.objects.filter(webhook_token=token, enabled=True).select_related("provider").first()


class ProviderVoiceSettingsSerializer(serializers.ModelSerializer):
    webhook_url_hint = serializers.SerializerMethodField()

    class Meta:
        model = ProviderVoiceSettings
        fields = [
            "enabled",
            "inbound_phone",
            "transfer_phone",
            "greeting_text",
            "ats_provider",
            "confirm_outbound_enabled",
            "webhook_token",
            "webhook_url_hint",
            "updated_at",
        ]
        read_only_fields = ["webhook_token", "webhook_url_hint", "updated_at"]

    def get_webhook_url_hint(self, obj):
        return "/api/voice/webhook/inbound/"


class VoiceCallTurnSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceCallTurn
        fields = ["id", "role", "text", "tool_name", "tool_payload", "created_at"]


class VoiceCallSessionSerializer(serializers.ModelSerializer):
    turns = VoiceCallTurnSerializer(many=True, read_only=True)

    class Meta:
        model = VoiceCallSession
        fields = [
            "id",
            "external_call_id",
            "caller_phone",
            "status",
            "booking_id",
            "started_at",
            "ended_at",
            "turns",
        ]


class VoiceSettingsView(APIView):
    """Provider: enable voice admin + webhook token."""

    def get(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        obj, _ = ProviderVoiceSettings.objects.get_or_create(provider=request.user)
        return Response(ProviderVoiceSettingsSerializer(obj).data)

    def patch(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        obj, _ = ProviderVoiceSettings.objects.get_or_create(provider=request.user)
        ser = ProviderVoiceSettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ProviderVoiceSettingsSerializer(obj).data)


class VoiceSessionsListView(APIView):
    def get(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = VoiceCallSession.objects.filter(provider=request.user).prefetch_related("turns")[:50]
        return Response(VoiceCallSessionSerializer(qs, many=True).data)


class VoiceInboundWebhookView(APIView):
    """
    Webhook для Mango / Novofon / generic.
    Header: X-Voice-Token: <webhook_token>
    Body: {event, call_id, caller_phone, text, ...} или формат АТС.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        vs = _resolve_voice_settings(request)
        if not vs:
            return Response({"detail": "Invalid or disabled voice token."}, status=status.HTTP_403_FORBIDDEN)

        data = request.data if isinstance(request.data, dict) else {}
        ats = (data.get("ats") or vs.ats_provider or "generic").strip()
        ev = normalize_inbound(data, ats=ats)

        if ev.get("hangup") or ev.get("event") == "hangup":
            if ev.get("call_id"):
                sess = VoiceCallSession.objects.filter(
                    provider=vs.provider,
                    external_call_id=ev["call_id"],
                    status=VoiceCallSession.Status.ACTIVE,
                ).first()
                if sess:
                    close_session(sess)
            return Response({"action": "hangup"})

        caller = ev.get("caller_phone") or data.get("caller_phone") or ""
        session = get_or_create_session(
            provider=vs.provider,
            call_id=ev.get("call_id") or "",
            caller_phone=caller,
        )

        user_text = ev.get("text") or ""
        if ev.get("event") == "incoming" and not user_text:
            result = process_turn(session, "", greeting=vs.greeting_text)
        else:
            result = process_turn(session, user_text, greeting=vs.greeting_text)

        return Response(result)


class VoiceSessionTurnView(APIView):
    """Ручной тест диалога: POST {text} без АТС."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, session_id: int):
        vs = _resolve_voice_settings(request)
        if not vs:
            return Response({"detail": "Invalid voice token."}, status=status.HTTP_403_FORBIDDEN)
        session = VoiceCallSession.objects.filter(pk=session_id, provider=vs.provider).first()
        if not session:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        text = (request.data.get("text") if isinstance(request.data, dict) else "") or ""
        return Response(process_turn(session, str(text).strip(), greeting=vs.greeting_text))


class VoiceSimulateCallView(APIView):
    """Старт тестового звонка: POST {text?} → session + first reply."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        vs = _resolve_voice_settings(request)
        if not vs:
            return Response({"detail": "Invalid voice token."}, status=status.HTTP_403_FORBIDDEN)
        data = request.data if isinstance(request.data, dict) else {}
        caller = (data.get("caller_phone") or "+79000000000").strip()
        session = get_or_create_session(
            provider=vs.provider,
            call_id=f"sim-{VoiceCallSession.objects.count() + 1}",
            caller_phone=caller,
        )
        first_text = (data.get("text") or "").strip()
        result = process_turn(session, first_text, greeting=vs.greeting_text)
        result["session_id"] = session.id
        return Response(result, status=status.HTTP_201_CREATED)
