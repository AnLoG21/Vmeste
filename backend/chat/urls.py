from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ConversationViewSet, MessageViewSet

router = DefaultRouter()
router.register(r"conversations", ConversationViewSet, basename="chat-conversations")
router.register(r"messages", MessageViewSet, basename="chat-messages")

urlpatterns = [
    path("", include(router.urls)),
]
