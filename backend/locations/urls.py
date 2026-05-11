from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProviderLocationViewSet

router = DefaultRouter()
router.register(r"", ProviderLocationViewSet, basename="locations")

urlpatterns = [
    path("", include(router.urls)),
]
