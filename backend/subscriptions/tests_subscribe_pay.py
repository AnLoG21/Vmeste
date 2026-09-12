"""API scenarios: subscription pay / confirm / renew with mocked YooKassa."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User

from subscriptions.models import Payment, SubscriptionPlan, UserSubscription


@override_settings(FRONTEND_URL="https://vsevmeste.space", YOOKASSA_SHOP_ID="shop-sub", DEBUG=False)
class SubscribePayApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="sub-pay-user",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Sub",
        )
        self.starter, _ = SubscriptionPlan.objects.get_or_create(
            slug="starter",
            defaults={
                "name": "Бесплатный",
                "price_monthly": Decimal("0"),
                "plan_type": SubscriptionPlan.PlanType.FREE,
                "product_kind": SubscriptionPlan.ProductKind.PLATFORM,
                "is_active": True,
            },
        )
        self.business, _ = SubscriptionPlan.objects.get_or_create(
            slug="business",
            defaults={
                "name": "Бизнес",
                "price_monthly": Decimal("1990.00"),
                "plan_type": SubscriptionPlan.PlanType.PAID,
                "product_kind": SubscriptionPlan.ProductKind.PLATFORM,
                "is_active": True,
            },
        )
        SubscriptionPlan.objects.filter(pk=self.starter.pk).update(
            plan_type=SubscriptionPlan.PlanType.FREE,
            price_monthly=Decimal("0"),
            is_active=True,
        )
        SubscriptionPlan.objects.filter(pk=self.business.pk).update(
            plan_type=SubscriptionPlan.PlanType.PAID,
            price_monthly=Decimal("1990.00"),
            is_active=True,
        )
        self.starter.refresh_from_db()
        self.business.refresh_from_db()
        self.api.force_authenticate(self.user)

    def test_pay_returns_confirmation_url(self):
        with patch(
            "subscriptions.views.create_payment",
            return_value={
                "id": "yk-sub-pay-1",
                "confirmation": {"confirmation_url": "https://pay.example/sub"},
            },
        ) as create_pay:
            res = self.api.post(
                "/api/subscriptions/pay/",
                {"plan_id": self.business.id},
                format="json",
            )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("confirmation_url"), "https://pay.example/sub")
        payment = Payment.objects.get(pk=res.data["payment_id"])
        self.assertEqual(payment.status, Payment.Status.PENDING)
        self.assertEqual(payment.yookassa_payment_id, "yk-sub-pay-1")
        self.assertEqual(payment.subscription.status, UserSubscription.Status.PENDING)
        kwargs = create_pay.call_args.kwargs
        self.assertIn("payment=success", kwargs["return_url"])
        self.assertIn(f"payment_id={payment.id}", kwargs["return_url"])

    def test_pay_rejects_starter_without_yookassa(self):
        with patch("subscriptions.views.create_payment") as create_pay:
            res = self.api.post(
                "/api/subscriptions/pay/",
                {"plan_id": self.starter.id},
                format="json",
            )
        self.assertIn(res.status_code, (400, 503), res.data)
        create_pay.assert_not_called()
        self.assertEqual(Payment.objects.count(), 0)

    def test_pay_yookassa_failure_cancels_pending(self):
        with patch("subscriptions.views.create_payment", return_value=None):
            res = self.api.post(
                "/api/subscriptions/pay/",
                {"plan_id": self.business.id},
                format="json",
            )
        self.assertEqual(res.status_code, 503, res.data)
        payment = Payment.objects.get()
        self.assertEqual(payment.status, Payment.Status.CANCELLED)
        self.assertEqual(payment.subscription.status, UserSubscription.Status.CANCELLED)

    def test_confirm_activates_after_succeeded(self):
        sub = UserSubscription.objects.create(
            user=self.user,
            plan=self.business,
            status=UserSubscription.Status.PENDING,
            source=UserSubscription.Source.PAID,
        )
        payment = Payment.objects.create(
            user=self.user,
            subscription=sub,
            plan=self.business,
            amount=self.business.price_monthly,
            status=Payment.Status.PENDING,
            yookassa_payment_id="yk-confirm-1",
        )
        with patch(
            "subscriptions.views.get_payment",
            return_value={"id": "yk-confirm-1", "status": "succeeded"},
        ):
            with patch("subscriptions.views._activate_subscription") as activate:
                res = self.api.post(
                    "/api/subscriptions/confirm/",
                    {"payment_id": payment.id},
                    format="json",
                )
        self.assertEqual(res.status_code, 200, res.data)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.SUCCEEDED)
        activate.assert_called_once_with(sub)

    def test_renew_paid_plan_calls_create_payment(self):
        sub = UserSubscription.objects.create(
            user=self.user,
            plan=self.business,
            status=UserSubscription.Status.ACTIVE,
            source=UserSubscription.Source.PAID,
        )
        with patch(
            "subscriptions.views.create_payment",
            return_value={
                "id": "yk-renew-1",
                "confirmation": {"confirmation_url": "https://pay.example/renew"},
            },
        ) as create_pay:
            res = self.api.post(
                "/api/subscriptions/renew/",
                {"subscription_id": sub.id},
                format="json",
            )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("confirmation_url"), "https://pay.example/renew")
        create_pay.assert_called_once()
        self.assertEqual(Payment.objects.filter(yookassa_payment_id="yk-renew-1").count(), 1)
