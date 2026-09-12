"""API: subscription promo apply + cancel at period end / pending."""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import User

from subscriptions.models import PromoRedemption, SubscriptionPlan, UserSubscription


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class CancelPromoApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="sub-cancel-promo",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Promo",
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
        SubscriptionPlan.objects.filter(pk=self.business.pk).update(
            plan_type=SubscriptionPlan.PlanType.PAID,
            price_monthly=Decimal("1990.00"),
            product_kind=SubscriptionPlan.ProductKind.PLATFORM,
            is_active=True,
        )
        self.api.force_authenticate(self.user)

    def _active_paid(self):
        return UserSubscription.objects.create(
            user=self.user,
            plan=self.business,
            status=UserSubscription.Status.ACTIVE,
            source=UserSubscription.Source.PAID,
            period_start=timezone.now(),
            period_end=timezone.now() + timedelta(days=30),
            auto_renew=True,
            cancel_at_period_end=False,
        )

    def test_promo_vsevmeste_activates_business(self):
        res = self.api.post("/api/subscriptions/promo/", {"code": "VSEVMESTE"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("Промокод применён", res.data.get("detail", ""))
        sub = UserSubscription.objects.filter(user=self.user, status=UserSubscription.Status.ACTIVE).first()
        self.assertIsNotNone(sub)
        self.assertEqual(sub.plan.slug, "business")
        self.assertEqual(sub.source, UserSubscription.Source.PROMO)
        self.assertEqual(sub.promo_code, "VSEVMESTE")
        self.assertTrue(PromoRedemption.objects.filter(user=self.user, code="VSEVMESTE").exists())

    def test_promo_second_apply_rejected(self):
        first = self.api.post("/api/subscriptions/promo/", {"code": "vsevmeste"}, format="json")
        self.assertEqual(first.status_code, 200, first.data)
        second = self.api.post("/api/subscriptions/promo/", {"code": "VSEVMESTE"}, format="json")
        self.assertEqual(second.status_code, 400, second.data)
        self.assertIn("уже активировали", second.data.get("detail", ""))

    def test_cancel_at_period_end(self):
        sub = self._active_paid()
        res = self.api.post(
            "/api/subscriptions/cancel/",
            {"subscription_id": sub.id, "immediate": False},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        sub.refresh_from_db()
        self.assertEqual(sub.status, UserSubscription.Status.ACTIVE)
        self.assertTrue(sub.cancel_at_period_end)
        self.assertFalse(sub.auto_renew)
        self.assertIn("Автопродление отключено", res.data.get("detail", ""))

    def test_cancel_pending_subscription(self):
        sub = UserSubscription.objects.create(
            user=self.user,
            plan=self.business,
            status=UserSubscription.Status.PENDING,
            source=UserSubscription.Source.PAID,
            auto_renew=False,
        )
        res = self.api.post(
            "/api/subscriptions/cancel/",
            {"subscription_id": sub.id, "immediate": False},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        sub.refresh_from_db()
        self.assertEqual(sub.status, UserSubscription.Status.CANCELLED)
        self.assertIn("отменена", res.data.get("detail", "").lower())
