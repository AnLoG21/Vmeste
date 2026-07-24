from django.urls import path

from .org_profile import OrganizationClientProfileView, ProviderGalleryView, ProviderOrganizationInfoView
from .views import (
    AutomationRequestView,
    ChangeEmailView,
    ChangePasswordView,
    ConfirmPasswordChangeView,
    MeView,
    PresencePingView,
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
    path("organization-profile/", OrganizationClientProfileView.as_view(), name="organization-client-profile"),
    path("organization-info/", ProviderOrganizationInfoView.as_view(), name="organization-info"),
    path("gallery/", ProviderGalleryView.as_view(), name="provider-gallery"),
    path("presence/ping/", PresencePingView.as_view(), name="user-presence-ping"),
    path("change-password/", ChangePasswordView.as_view(), name="user-change-password"),
    path("confirm-password-change/", ConfirmPasswordChangeView.as_view(), name="user-confirm-password-change"),
    path("change-email/", ChangeEmailView.as_view(), name="user-change-email"),
    path("automation-request/", AutomationRequestView.as_view(), name="automation-request"),
]
