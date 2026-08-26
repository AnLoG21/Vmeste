import logging
import re

from django.conf import settings
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User

from .asterisk_sync import find_settings_by_did, sync_asterisk_configs
from .models import ProviderVoiceSettings, VoiceCallSession, VoiceCallTurn
from .outbound import dial_booking_confirmation, pending_confirmation_bookings, run_outbound_confirmations
from .orchestrator import close_session, get_or_create_session, process_turn
from .speechkit import attach_tts_to_response, speechkit_ready, transcribe_event_text
from .telephony import normalize_inbound

logger = logging.getLogger(__name__)


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
    speechkit_ready = serializers.SerializerMethodField()
    voice_minutes_left = serializers.SerializerMethodField()
    has_mango = serializers.SerializerMethodField()
    has_sip = serializers.SerializerMethodField()

    class Meta:
        model = ProviderVoiceSettings
        fields = [
            "enabled",
            "inbound_phone",
            "transfer_phone",
            "greeting_text",
            "ats_provider",
            "confirm_outbound_enabled",
            "tts_enabled",
            "legal_ack",
            "caller_disclosure",
            "mango_api_key",
            "mango_api_salt",
            "mango_line_number",
            "mango_extension",
            "sip_server",
            "sip_username",
            "sip_password",
            "sip_auth_user",
            "sip_did",
            "webhook_token",
            "webhook_url_hint",
            "has_mango",
            "has_sip",
            "speechkit_ready",
            "voice_minutes_quota",
            "voice_minutes_used",
            "voice_minutes_left",
            "updated_at",
        ]
        read_only_fields = [
            "webhook_token",
            "webhook_url_hint",
            "has_mango",
            "has_sip",
            "speechkit_ready",
            "voice_minutes_quota",
            "voice_minutes_used",
            "voice_minutes_left",
            "updated_at",
        ]
        extra_kwargs = {
            "mango_api_key": {"write_only": True},
            "mango_api_salt": {"write_only": True},
            "sip_password": {"write_only": True, "required": False, "allow_blank": True},
        }

    def get_has_mango(self, obj):
        return obj.has_mango()

    def get_has_sip(self, obj):
        return obj.has_sip()

    def get_webhook_url_hint(self, obj):
        return "/api/voice/webhook/inbound/"

    def get_speechkit_ready(self, obj):
        return speechkit_ready()

    def get_voice_minutes_left(self, obj):
        from .usage import remaining_minutes

        return remaining_minutes(obj)


def _voice_response(result: dict, vs: ProviderVoiceSettings) -> dict:
    return attach_tts_to_response(result, enabled=bool(vs.tts_enabled), vs=vs)


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
        data = request.data if isinstance(request.data, dict) else {}
        ser = ProviderVoiceSettingsSerializer(obj, data=data, partial=True)
        ser.is_valid(raise_exception=True)
        validated = dict(ser.validated_data)
        validated.pop("sip_password", None)
        for key, val in validated.items():
            setattr(obj, key, val)
        will_enable = bool(obj.enabled)
        if will_enable and not bool(obj.legal_ack):
            return Response(
                {
                    "detail": (
                        "Чтобы включить голос, подтвердите согласие 152-ФЗ "
                        "(уведомление звонящего и обработка речи через SpeechKit)."
                    ),
                    "code": "voice_legal_ack_required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.save()
        if (data.get("sip_password") or "").strip():
            obj.sip_password = str(data["sip_password"]).strip()
            obj.save(update_fields=["sip_password"])
        try:
            sync_asterisk_configs()
        except Exception:
            logger.exception("voice asterisk sync failed")
            try:
                from common.ops_alerts import alert_ops

                alert_ops("asterisk_sync_failed", f"provider={request.user.id}")
            except Exception:
                pass
        return Response(ProviderVoiceSettingsSerializer(obj).data)


class VoiceSessionsListView(APIView):
    def get(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = VoiceCallSession.objects.filter(provider=request.user).prefetch_related("turns")[:50]
        return Response(VoiceCallSessionSerializer(qs, many=True).data)


class VoiceOutboundPendingView(APIView):
    """Записи на ближайшие сутки для исходящего подтверждения."""

    def get(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        vs = ProviderVoiceSettings.objects.filter(provider=request.user).first()
        if not vs or not vs.confirm_outbound_enabled:
            return Response({"bookings": [], "enabled": False})
        rows = pending_confirmation_bookings(request.user.id)
        return Response({"bookings": rows, "enabled": True})


class VoiceOutboundRunView(APIView):
    """Запустить исходящий обзвон подтверждений (все pending или одна запись)."""

    def post(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        vs = ProviderVoiceSettings.objects.filter(provider=request.user).first()
        if not vs or not vs.confirm_outbound_enabled:
            return Response(
                {"detail": "Включите исходящие звонки в настройках голоса."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = request.data if isinstance(request.data, dict) else {}
        booking_id = data.get("booking_id")
        if booking_id:
            result = dial_booking_confirmation(vs, int(booking_id))
            if not result.get("ok"):
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
            return Response(result)
        result = run_outbound_confirmations(request.user.id, limit=int(data.get("limit") or 10))
        return Response(result)


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
        called = ev.get("called_phone") or data.get("called_phone") or ""
        session = get_or_create_session(
            provider=vs.provider,
            call_id=ev.get("call_id") or "",
            caller_phone=caller,
            called_phone=called,
        )

        user_text = transcribe_event_text(data, ev, vs)
        if ev.get("event") == "incoming" and not user_text:
            result = process_turn(session, "", greeting=vs.effective_greeting())
        else:
            result = process_turn(session, user_text, greeting=vs.effective_greeting())

        return Response(_voice_response(result, vs))


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
        result = process_turn(session, str(text).strip(), greeting=vs.effective_greeting())
        return Response(_voice_response(result, vs))


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
        result = process_turn(session, first_text, greeting=vs.effective_greeting())
        result["session_id"] = session.id
        return Response(_voice_response(result, vs), status=status.HTTP_201_CREATED)


class VoiceAsteriskResolveView(APIView):
    """Internal: Asterisk AGI resolves salon by DID → webhook token."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        secret = (request.headers.get("X-Asterisk-Secret") or "").strip()
        expected = (getattr(settings, "ASTERISK_INTERNAL_SECRET", "") or "").strip()
        if not expected or secret != expected:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        did = (request.query_params.get("did") or "").strip()
        vs = find_settings_by_did(did)
        if not vs:
            return Response({"detail": "Salon not found for this number."}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "provider_id": vs.provider_id,
                "webhook_token": vs.webhook_token,
                "organization_name": getattr(vs.provider, "organization_name", "") or "",
            }
        )
