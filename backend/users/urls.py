from django.urls import path

from .views import (
    ChangeEmailView,
    ChangePasswordView,
    MeView,
    ResendVerificationView,
    RolesView,
    SpheresView,
    UserRegisterView,
    VerifyEmailView,
)

urlpatterns = [
    path("roles/", RolesView.as_view(), name="user-roles"),
    path("spheres/", SpheresView.as_view(), name="user-spheres"),
    path("register/", UserRegisterView.as_view(), name="user-register"),
    path("verify-email/", VerifyEmailView.as_view(), name="user-verify-email"),
    path("resend-verification/", ResendVerificationView.as_view(), name="user-resend-verification"),
    path("me/", MeView.as_view(), name="user-me"),
    path("change-password/", ChangePasswordView.as_view(), name="user-change-password"),
    path("change-email/", ChangeEmailView.as_view(), name="user-change-email"),
]
