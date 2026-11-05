from django.urls import path

from .views import (
    AgentFrameView,
    AgentHeartbeatView,
    AgentInputView,
    CastAckView,
    CastCreateView,
    CastLatestView,
    CastNextView,
)

urlpatterns = [
    path("cast/", CastCreateView.as_view(), name="vefire-cast-create"),
    path("cast/next/", CastNextView.as_view(), name="vefire-cast-next"),
    path("cast/latest/", CastLatestView.as_view(), name="vefire-cast-latest"),
    path("cast/<int:pk>/ack/", CastAckView.as_view(), name="vefire-cast-ack"),
    path("agent/heartbeat/", AgentHeartbeatView.as_view(), name="vefire-agent-heartbeat"),
    path("agent/frame/", AgentFrameView.as_view(), name="vefire-agent-frame"),
    path("agent/input/", AgentInputView.as_view(), name="vefire-agent-input"),
]
