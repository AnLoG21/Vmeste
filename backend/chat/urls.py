from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ChatActivitySummaryView, ConversationViewSet, MessageViewSet

router = DefaultRouter()
router.register(r"conversations", ConversationViewSet, basename="chat-conversations")
router.register(r"messages", MessageViewSet, basename="chat-messages")

urlpatterns = [
    path("activity/", ChatActivitySummaryView.as_view(), name="chat-activity-summary"),
    path("", include(router.urls)),
]
