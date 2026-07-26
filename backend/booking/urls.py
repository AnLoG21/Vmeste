from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .analytics import AnalyticsSummaryView
from .views import AvailabilitySlotViewSet, BookingViewSet, ProviderStaffViewSet

router = DefaultRouter()
router.register(r"slots", AvailabilitySlotViewSet, basename="booking-slots")
router.register(r"staff", ProviderStaffViewSet, basename="booking-staff")
router.register(r"", BookingViewSet, basename="booking")

urlpatterns = [
    path("analytics/", AnalyticsSummaryView.as_view(), name="booking-analytics"),
    path("", include(router.urls)),
]
