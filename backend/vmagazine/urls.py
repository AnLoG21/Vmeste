from django.urls import path

from .commerce_views import (
    AddressesView,
    BonusesView,
    CartView,
    HomeFeedView,
    PaymentCardsView,
    ProductAuthenticityRequestView,
    ProductAuthenticityVerifyView,
    ProductLikeView,
    ProductViewTrackView,
    ProfileHubView,
    RecentlyViewedView,
    SearchSuggestView,
)
from .views import VmagazineFavoritesView, VmagazineMyOrdersView, VmagazineShopsSearchView

urlpatterns = [
    path("shops/", VmagazineShopsSearchView.as_view()),
    path("favorites/", VmagazineFavoritesView.as_view()),
    path("my-orders/", VmagazineMyOrdersView.as_view()),
    path("home/", HomeFeedView.as_view()),
    path("search/suggest/", SearchSuggestView.as_view()),
    path("product-likes/", ProductLikeView.as_view()),
    path("cart/", CartView.as_view()),
    path("products/<int:product_id>/view/", ProductViewTrackView.as_view()),
    path("recently-viewed/", RecentlyViewedView.as_view()),
    path("addresses/", AddressesView.as_view()),
    path("bonuses/", BonusesView.as_view()),
    path("payment-cards/", PaymentCardsView.as_view()),
    path("profile/", ProfileHubView.as_view()),
    path(
        "products/<int:product_id>/authenticity/request/",
        ProductAuthenticityRequestView.as_view(),
    ),
    path(
        "products/<int:product_id>/authenticity/verify/",
        ProductAuthenticityVerifyView.as_view(),
    ),
]
