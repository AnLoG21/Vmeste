from django.urls import path

from .views import (
    VoiceInboundWebhookView,
    VoiceOutboundPendingView,
    VoiceSessionsListView,
    VoiceSessionTurnView,
    VoiceSettingsView,
    VoiceSimulateCallView,
)

urlpatterns = [
    path("settings/", VoiceSettingsView.as_view(), name="voice-settings"),
    path("sessions/", VoiceSessionsListView.as_view(), name="voice-sessions"),
    path("outbound/pending/", VoiceOutboundPendingView.as_view(), name="voice-outbound-pending"),
    path("webhook/inbound/", VoiceInboundWebhookView.as_view(), name="voice-webhook-inbound"),
    path("simulate/", VoiceSimulateCallView.as_view(), name="voice-simulate"),
    path("session/<int:session_id>/turn/", VoiceSessionTurnView.as_view(), name="voice-session-turn"),
]
