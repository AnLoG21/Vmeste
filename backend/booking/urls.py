from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AvailabilitySlotViewSet, BookingViewSet, ProviderStaffViewSet

router = DefaultRouter()
router.register(r"slots", AvailabilitySlotViewSet, basename="booking-slots")
router.register(r"staff", ProviderStaffViewSet, basename="booking-staff")
router.register(r"", BookingViewSet, basename="booking")

urlpatterns = [
    path("", include(router.urls)),
]
