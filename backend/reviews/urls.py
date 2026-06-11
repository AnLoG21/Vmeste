from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProviderReviewSummaryView, ReviewViewSet

router = DefaultRouter()
router.register("", ReviewViewSet, basename="review")

urlpatterns = [
    path("summary/", ProviderReviewSummaryView.as_view(), name="review-summary"),
    path("", include(router.urls)),
]
