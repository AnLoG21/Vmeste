from django.urls import path

from .views import HealthView, InAppNotificationMarkReadView

urlpatterns = [
    path("health/", HealthView.as_view(), name="notifications-health"),
    path("in-app/mark-read/", InAppNotificationMarkReadView.as_view(), name="notifications-in-app-mark-read"),
]
