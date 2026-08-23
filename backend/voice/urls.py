from django.urls import path

from .views import (
    VoiceAsteriskResolveView,
    VoiceInboundWebhookView,
    VoiceOutboundPendingView,
    VoiceOutboundRunView,
    VoiceSessionsListView,
    VoiceSessionTurnView,
    VoiceSettingsView,
    VoiceSimulateCallView,
)

urlpatterns = [
    path("settings/", VoiceSettingsView.as_view(), name="voice-settings"),
    path("sessions/", VoiceSessionsListView.as_view(), name="voice-sessions"),
    path("outbound/pending/", VoiceOutboundPendingView.as_view(), name="voice-outbound-pending"),
    path("outbound/run/", VoiceOutboundRunView.as_view(), name="voice-outbound-run"),
    path("webhook/inbound/", VoiceInboundWebhookView.as_view(), name="voice-webhook-inbound"),
    path("asterisk/resolve/", VoiceAsteriskResolveView.as_view(), name="voice-asterisk-resolve"),
    path("simulate/", VoiceSimulateCallView.as_view(), name="voice-simulate"),
    path("session/<int:session_id>/turn/", VoiceSessionTurnView.as_view(), name="voice-session-turn"),
]
