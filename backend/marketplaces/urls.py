from django.urls import path

from . import views

urlpatterns = [
    path("settings/", views.MarketplaceSettingsView.as_view()),
    path("history/", views.MarketplaceHistoryView.as_view()),
    path("templates/", views.MarketplaceTemplateView.as_view()),
    path("templates/<int:pk>/", views.MarketplaceTemplateView.as_view()),
    path("products/import/", views.MarketplaceImportView.as_view()),
    path("products/import-status/", views.MarketplaceImportStatusView.as_view()),
    path("products/fetch/", views.MarketplaceProductFetchView.as_view()),
    path("call/", views.MarketplaceCallView.as_view()),
    path("media/", views.MarketplaceMediaView.as_view()),
    path("generate-description/", views.MarketplaceDescribeView.as_view()),
    path("yandex-disk/start/", views.YandexDiskStartView.as_view()),
    path("yandex-disk/callback/", views.YandexDiskCallbackView.as_view()),
    path("logs/", views.MarketplaceLogsView.as_view()),
    path("export/", views.MarketplaceExportView.as_view()),
    path("barcodes/generate/", views.MarketplaceBarcodeView.as_view()),
    path("sync/", views.MarketplaceSyncView.as_view()),
    path("webhook/", views.MarketplaceWebhookView.as_view()),
]
