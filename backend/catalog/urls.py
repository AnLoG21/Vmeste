from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ServiceCategoryViewSet, ServiceViewSet

router = DefaultRouter()
router.register(r"categories", ServiceCategoryViewSet, basename="catalog-categories")
router.register(r"services", ServiceViewSet, basename="catalog-services")

urlpatterns = [
    path("", include(router.urls)),
]
