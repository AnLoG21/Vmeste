from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .analytics import AnalyticsSummaryView
from .calendar_feed import CalendarFeedView, CalendarSettingsView
from .views import (
    AcquiringSettingsView,
    AvailabilitySlotViewSet,
    BookingViewSet,
    MessagingSettingsView,
    ProviderStaffViewSet,
    TelegramOrgLinkView,
)

router = DefaultRouter()
router.register(r"slots", AvailabilitySlotViewSet, basename="booking-slots")
router.register(r"staff", ProviderStaffViewSet, basename="booking-staff")
router.register(r"", BookingViewSet, basename="booking")

urlpatterns = [
    path("analytics/", AnalyticsSummaryView.as_view(), name="booking-analytics"),
    path("acquiring/", AcquiringSettingsView.as_view(), name="booking-acquiring"),
    path("messaging/", MessagingSettingsView.as_view(), name="booking-messaging"),
    path("messaging/telegram-link/", TelegramOrgLinkView.as_view(), name="booking-messaging-telegram-link"),
    path("calendar/settings/", CalendarSettingsView.as_view(), name="booking-calendar-settings"),
    path("calendar/<str:token>.ics", CalendarFeedView.as_view(), name="booking-calendar-ics"),
    path("", include(router.urls)),
]
