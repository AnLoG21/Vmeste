from django.urls import path

from . import views

urlpatterns = [
    path("status/", views.MoyNalogStatusView.as_view(), name="moy-nalog-status"),
    path("connect/password/", views.MoyNalogConnectPasswordView.as_view(), name="moy-nalog-connect-password"),
    path("connect/sms/start/", views.MoyNalogSmsStartView.as_view(), name="moy-nalog-sms-start"),
    path("connect/sms/verify/", views.MoyNalogSmsVerifyView.as_view(), name="moy-nalog-sms-verify"),
    path("disconnect/", views.MoyNalogDisconnectView.as_view(), name="moy-nalog-disconnect"),
    path("receipts/", views.MoyNalogReceiptListView.as_view(), name="moy-nalog-receipts"),
    path("receipts/<int:pk>/retry/", views.MoyNalogReceiptRetryView.as_view(), name="moy-nalog-receipt-retry"),
]
