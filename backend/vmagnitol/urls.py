from django.urls import path

from .views import (
    BrandDetailView,
    BrandListCreateView,
    CarModelDetailView,
    CarModelListCreateView,
    GuideDetailView,
    GuideFileDeleteView,
    GuideFileUploadView,
    GuideListCreateView,
    GuideStepDetailView,
    GuideStepListCreateView,
)

urlpatterns = [
    path("brands/", BrandListCreateView.as_view(), name="vmagnitol-brands"),
    path("brands/<int:pk>/", BrandDetailView.as_view(), name="vmagnitol-brand-detail"),
    path(
        "brands/<int:brand_id>/models/",
        CarModelListCreateView.as_view(),
        name="vmagnitol-models",
    ),
    path("models/<int:pk>/", CarModelDetailView.as_view(), name="vmagnitol-model-detail"),
    path(
        "models/<int:model_id>/guides/",
        GuideListCreateView.as_view(),
        name="vmagnitol-guides",
    ),
    path("guides/<int:pk>/", GuideDetailView.as_view(), name="vmagnitol-guide-detail"),
    path(
        "guides/<int:guide_id>/steps/",
        GuideStepListCreateView.as_view(),
        name="vmagnitol-steps",
    ),
    path("steps/<int:pk>/", GuideStepDetailView.as_view(), name="vmagnitol-step-detail"),
    path(
        "guides/<int:guide_id>/files/",
        GuideFileUploadView.as_view(),
        name="vmagnitol-files",
    ),
    path("files/<int:pk>/", GuideFileDeleteView.as_view(), name="vmagnitol-file-delete"),
]