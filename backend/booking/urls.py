from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .analytics import AnalyticsSummaryView
from .calendar_feed import CalendarFeedView, CalendarSettingsView
from .loyalty_views import (
    ClientPackageViewSet,
    LoyaltySettingsView,
    MyLoyaltyAccountsView,
    MyLoyaltyView,
    VisitPackageViewSet,
)
from .public_widget import (
    PublicWidgetBookView,
    PublicWidgetCatalogView,
    PublicWidgetDatesView,
    PublicWidgetWindowsView,
)
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
router.register(r"packages", VisitPackageViewSet, basename="booking-packages")
router.register(r"client-packages", ClientPackageViewSet, basename="booking-client-packages")
router.register(r"", BookingViewSet, basename="booking")

urlpatterns = [
    path("analytics/", AnalyticsSummaryView.as_view(), name="booking-analytics"),
    path("acquiring/", AcquiringSettingsView.as_view(), name="booking-acquiring"),
    path("messaging/", MessagingSettingsView.as_view(), name="booking-messaging"),
    path("messaging/telegram-link/", TelegramOrgLinkView.as_view(), name="booking-messaging-telegram-link"),
    path("calendar/settings/", CalendarSettingsView.as_view(), name="booking-calendar-settings"),
    path("calendar/<str:token>.ics", CalendarFeedView.as_view(), name="booking-calendar-ics"),
    path("loyalty/settings/", LoyaltySettingsView.as_view(), name="booking-loyalty-settings"),
    path("loyalty/me/", MyLoyaltyView.as_view(), name="booking-loyalty-me"),
    path("loyalty/accounts/", MyLoyaltyAccountsView.as_view(), name="booking-loyalty-accounts"),
    path("public/<slug:slug>/", PublicWidgetCatalogView.as_view(), name="booking-widget-catalog"),
    path("public/<slug:slug>/windows/", PublicWidgetWindowsView.as_view(), name="booking-widget-windows"),
    path("public/<slug:slug>/dates/", PublicWidgetDatesView.as_view(), name="booking-widget-dates"),
    path("public/<slug:slug>/book/", PublicWidgetBookView.as_view(), name="booking-widget-book"),
    path("", include(router.urls)),
]
