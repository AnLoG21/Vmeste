from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ProviderQuickStartView,
    SeedProviderCatalogView,
    ServiceCategoryViewSet,
    ServiceViewSet,
    SphereCatalogListView,
    SphereCatalogTemplateView,
)

router = DefaultRouter()
router.register(r"categories", ServiceCategoryViewSet, basename="catalog-categories")
router.register(r"services", ServiceViewSet, basename="catalog-services")

urlpatterns = [
    path("sphere-catalogs/", SphereCatalogListView.as_view(), name="catalog-sphere-list"),
    path("sphere-template/", SphereCatalogTemplateView.as_view(), name="catalog-sphere-template"),
    path("seed-catalog/", SeedProviderCatalogView.as_view(), name="catalog-seed"),
    path("quick-start/", ProviderQuickStartView.as_view(), name="catalog-quick-start"),
    path("", include(router.urls)),
]
