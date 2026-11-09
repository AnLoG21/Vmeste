from django.urls import path

from .views import (
    DomainAttachView,
    DomainCheckView,
    DomainPurchaseView,
    EntitlementView,
    ResolveHostView,
    ServePublishedView,
    SiteAssetUploadView,
    SiteDetailView,
    SiteListCreateView,
    SitePublishView,
    SiteUnpublishView,
    TlsAskView,
)

urlpatterns = [
    path("entitlement/", EntitlementView.as_view(), name="vsayte-entitlement"),
    path("sites/", SiteListCreateView.as_view(), name="vsayte-sites"),
    path("sites/<int:pk>/", SiteDetailView.as_view(), name="vsayte-site-detail"),
    path("sites/<int:pk>/publish/", SitePublishView.as_view(), name="vsayte-site-publish"),
    path("sites/<int:pk>/unpublish/", SiteUnpublishView.as_view(), name="vsayte-site-unpublish"),
    path("sites/<int:pk>/assets/", SiteAssetUploadView.as_view(), name="vsayte-site-assets"),
    path("sites/<int:pk>/domains/purchase/", DomainPurchaseView.as_view(), name="vsayte-domain-purchase"),
    path("sites/<int:pk>/domains/attach/", DomainAttachView.as_view(), name="vsayte-domain-attach"),
    path("domains/check/", DomainCheckView.as_view(), name="vsayte-domain-check"),
    path("resolve/", ResolveHostView.as_view(), name="vsayte-resolve"),
    path("tls-ask/", TlsAskView.as_view(), name="vsayte-tls-ask"),
    path("serve/", ServePublishedView.as_view(), name="vsayte-serve-root"),
    path("serve/<path:path>", ServePublishedView.as_view(), name="vsayte-serve"),
]
