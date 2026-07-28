from django.urls import path

from . import views

urlpatterns = [
    path("settings/", views.CafeSettingsView.as_view()),
    path("floors/", views.CafeFloorPlanListCreateView.as_view()),
    path("floors/<int:pk>/", views.CafeFloorPlanDetailView.as_view()),
    path("floors/<int:plan_id>/tables/", views.CafeTableListCreateView.as_view()),
    path("tables/<int:pk>/", views.CafeTableDetailView.as_view()),
    path("menu/categories/", views.CafeMenuCategoryListCreateView.as_view()),
    path("menu/categories/<int:pk>/", views.CafeMenuCategoryDetailView.as_view()),
    path("menu/items/", views.CafeMenuItemListCreateView.as_view()),
    path("menu/items/<int:pk>/", views.CafeMenuItemDetailView.as_view()),
    path("menu/items/<int:item_id>/photos/", views.CafeMenuItemPhotoView.as_view()),
    path("menu/items/<int:item_id>/photos/<int:photo_id>/", views.CafeMenuItemPhotoView.as_view()),
    path("orders/", views.CafeProviderOrdersView.as_view()),
    path("orders/<int:pk>/", views.CafeProviderOrdersView.as_view()),
    path("t/<str:token>/", views.CafeTablePublicView.as_view()),
    path("t/<str:token>/unlock/", views.CafeTableUnlockView.as_view()),
    path("m/<slug:slug>/", views.CafeOrgPublicView.as_view()),
    path("guest/menu/", views.CafeGuestMenuView.as_view()),
    path("guest/order/", views.CafeGuestOrderCreateView.as_view()),
    path("guest/order/<int:order_id>/", views.CafeGuestOrderDetailView.as_view()),
    path("menu/items/<int:item_id>/ingredients/", views.CafeMenuItemIngredientView.as_view()),
    path("menu/items/<int:item_id>/ingredients/<int:ingredient_id>/", views.CafeMenuItemIngredientView.as_view()),
    path("menu/items/<int:pk>/rate/", views.CafeMenuItemRateView.as_view()),
]
