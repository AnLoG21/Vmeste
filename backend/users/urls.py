from django.urls import path

from .org_profile import OrganizationClientProfileView, ProviderGalleryView, ProviderOrganizationInfoView
from .public_org import PublicOrganizationBySlugView, PublicOrganizationSitemapView, SitemapXmlView
from .seo_html import SeoCityHtmlView, SeoMenuHtmlView, SeoOrgHtmlView
from .views import (
    AutomationRequestView,
    ChangeEmailView,
    ChangePasswordView,
    ConfirmPasswordChangeView,
    ConfirmPasswordResetView,
    RequestPasswordResetView,
    DeleteAccountView,
    DemoExitView,
    DemoLoginView,
    MeView,
    PresencePingView,
    ResendVerificationView,
    RolesView,
    SetupCredentialsView,
    SpheresView,
    UserRegisterView,
    VerifyEmailView,
)
from .oauth import VkOAuthCallbackView, VkOAuthStartView, YandexOAuthCallbackView, YandexOAuthStartView
from .telegram_auth import AuthProvidersView, TelegramLoginView

urlpatterns = [
    path("roles/", RolesView.as_view(), name="user-roles"),
    path("spheres/", SpheresView.as_view(), name="user-spheres"),
    path("register/", UserRegisterView.as_view(), name="user-register"),
    path("auth/providers/", AuthProvidersView.as_view(), name="user-auth-providers"),
    path("auth/telegram/", TelegramLoginView.as_view(), name="user-auth-telegram"),
    path("auth/yandex/", YandexOAuthStartView.as_view(), name="user-auth-yandex"),
    path("auth/yandex/callback/", YandexOAuthCallbackView.as_view(), name="user-auth-yandex-callback"),
    path("auth/vk/", VkOAuthStartView.as_view(), name="user-auth-vk"),
    path("auth/vk/callback/", VkOAuthCallbackView.as_view(), name="user-auth-vk-callback"),
    path("verify-email/", VerifyEmailView.as_view(), name="user-verify-email"),
    path("resend-verification/", ResendVerificationView.as_view(), name="user-resend-verification"),
    path("me/", MeView.as_view(), name="user-me"),
    path("me/setup-credentials/", SetupCredentialsView.as_view(), name="user-setup-credentials"),
    path("me/delete/", DeleteAccountView.as_view(), name="user-delete-account"),
    path("organization-profile/", OrganizationClientProfileView.as_view(), name="organization-client-profile"),
    path("public-org/<slug:slug>/", PublicOrganizationBySlugView.as_view(), name="public-org-by-slug"),
    path("public-orgs/", PublicOrganizationSitemapView.as_view(), name="public-orgs-list"),
    path("sitemap.xml", SitemapXmlView.as_view(), name="users-sitemap-xml"),
    path("seo/o/<slug:slug>/", SeoOrgHtmlView.as_view(), name="seo-org-html"),
    path("seo/m/<slug:slug>/", SeoMenuHtmlView.as_view(), name="seo-menu-html"),
    path("seo/city/<slug:city_key>/", SeoCityHtmlView.as_view(), name="seo-city-html"),
    path("organization-info/", ProviderOrganizationInfoView.as_view(), name="organization-info"),
    path("gallery/", ProviderGalleryView.as_view(), name="provider-gallery"),
    path("presence/ping/", PresencePingView.as_view(), name="user-presence-ping"),
    path("change-password/", ChangePasswordView.as_view(), name="user-change-password"),
    path("confirm-password-change/", ConfirmPasswordChangeView.as_view(), name="user-confirm-password-change"),
    path("request-password-reset/", RequestPasswordResetView.as_view(), name="user-request-password-reset"),
    path("confirm-password-reset/", ConfirmPasswordResetView.as_view(), name="user-confirm-password-reset"),
    path("change-email/", ChangeEmailView.as_view(), name="user-change-email"),
    path("demo-login/", DemoLoginView.as_view(), name="user-demo-login"),
    path("demo-exit/", DemoExitView.as_view(), name="user-demo-exit"),
    path("automation-request/", AutomationRequestView.as_view(), name="automation-request"),
]
