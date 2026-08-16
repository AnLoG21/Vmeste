from django.urls import path

from .views import (
    HealthView,
    InAppNotificationMarkReadView,
    RegisterPushTokenView,
    TelegramLinkTokenView,
    TelegramWebhookView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="notifications-health"),
    path("in-app/mark-read/", InAppNotificationMarkReadView.as_view(), name="notifications-in-app-mark-read"),
    path("push/register/", RegisterPushTokenView.as_view(), name="notifications-push-register"),
    path("telegram/link/", TelegramLinkTokenView.as_view(), name="notifications-telegram-link"),
    path("telegram/webhook/", TelegramWebhookView.as_view(), name="notifications-telegram-webhook"),
]
