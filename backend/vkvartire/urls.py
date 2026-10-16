from django.urls import path

from .views import (
    VkvartireFavoritesView,
    VkvartireFeedView,
    VkvartireListingChatView,
    VkvartireListingDetailView,
    VkvartireMapView,
    VkvartireSavedSearchDetailView,
    VkvartireSavedSearchListView,
)

urlpatterns = [
    path("feed/", VkvartireFeedView.as_view()),
    path("map/", VkvartireMapView.as_view()),
    path("listings/<int:listing_id>/", VkvartireListingDetailView.as_view()),
    path("listings/<int:listing_id>/chat/", VkvartireListingChatView.as_view()),
    path("favorites/", VkvartireFavoritesView.as_view()),
    path("saved-searches/", VkvartireSavedSearchListView.as_view()),
    path("saved-searches/<int:search_id>/", VkvartireSavedSearchDetailView.as_view()),
]
