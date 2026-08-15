from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    InspectionItemDetailView,
    InspectionItemPhotoView,
    InspectionPublicApproveView,
    InspectionPublicView,
    InspectionReportViewSet,
)

router = DefaultRouter()
router.register(r"reports", InspectionReportViewSet, basename="inspection-report")

urlpatterns = [
    path("public/<uuid:token>/", InspectionPublicView.as_view(), name="inspection-public"),
    path(
        "public/<uuid:token>/approve/",
        InspectionPublicApproveView.as_view(),
        name="inspection-public-approve",
    ),
    path("items/<int:pk>/", InspectionItemDetailView.as_view(), name="inspection-item"),
    path("items/<int:pk>/photos/", InspectionItemPhotoView.as_view(), name="inspection-item-photos"),
    path(
        "items/<int:pk>/photos/<int:photo_id>/",
        InspectionItemPhotoView.as_view(),
        name="inspection-item-photo-detail",
    ),
    path("", include(router.urls)),
]
