from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ProductCategoryViewSet,
    ProductSubcategoryViewSet,
    ProductViewSet,
    PublicShopCatalogView,
    PublicShopOrderCreateView,
    PublicShopOrderStatusView,
    ServiceMaterialViewSet,
    ShopOrderViewSet,
    ShopSettingsView,
    StockMovementViewSet,
)

router = DefaultRouter()
router.register(r"categories", ProductCategoryViewSet, basename="shop-categories")
router.register(r"subcategories", ProductSubcategoryViewSet, basename="shop-subcategories")
router.register(r"products", ProductViewSet, basename="shop-products")
router.register(r"stock-movements", StockMovementViewSet, basename="shop-stock-movements")
router.register(r"materials", ServiceMaterialViewSet, basename="shop-materials")
router.register(r"orders", ShopOrderViewSet, basename="shop-orders")

urlpatterns = [
    path("settings/", ShopSettingsView.as_view(), name="shop-settings"),
    path("public/<slug:slug>/", PublicShopCatalogView.as_view(), name="shop-public-catalog"),
    path("public/<slug:slug>/order/", PublicShopOrderCreateView.as_view(), name="shop-public-order"),
    path(
        "public/<slug:slug>/order/<int:order_id>/",
        PublicShopOrderStatusView.as_view(),
        name="shop-public-order-status",
    ),
    path("", include(router.urls)),
]
