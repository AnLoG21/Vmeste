from django.urls import path

from .views import VmagazineFavoritesView, VmagazineMyOrdersView, VmagazineShopsSearchView

urlpatterns = [
    path("shops/", VmagazineShopsSearchView.as_view()),
    path("favorites/", VmagazineFavoritesView.as_view()),
    path("my-orders/", VmagazineMyOrdersView.as_view()),
]
