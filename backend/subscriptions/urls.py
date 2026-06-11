from django.urls import path

from .views import (
    CancelSubscriptionView,
    ConfirmPaymentView,
    CreatePaymentView,
    MyPaymentsView,
    MySubscriptionsView,
    PlansListView,
    RenewSubscriptionView,
    ToggleAutoRenewView,
    YooKassaWebhookView,
)

urlpatterns = [
    path("plans/", PlansListView.as_view(), name="subscription-plans"),
    path("mine/", MySubscriptionsView.as_view(), name="my-subscriptions"),
    path("payments/", MyPaymentsView.as_view(), name="my-payments"),
    path("pay/", CreatePaymentView.as_view(), name="create-payment"),
    path("confirm/", ConfirmPaymentView.as_view(), name="confirm-payment"),
    path("renew/", RenewSubscriptionView.as_view(), name="renew-subscription"),
    path("auto-renew/", ToggleAutoRenewView.as_view(), name="toggle-auto-renew"),
    path("cancel/", CancelSubscriptionView.as_view(), name="cancel-subscription"),
    path("webhook/yookassa/", YooKassaWebhookView.as_view(), name="yookassa-webhook"),
]
