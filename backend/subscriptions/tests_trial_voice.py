"""Trial activation, free→business renew remap, voice quota limits."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from subscriptions.access import provider_can_manage_staff
from subscriptions.models import SubscriptionPlan, UserSubscription
from subscriptions.views import ActivateTrialView, RenewSubscriptionView
from subscriptions.voice_entitlement import apply_voice_quota_from_plan, on_subscription_activated
from voice.models import ProviderVoiceSettings
from voice.usage import can_use_speechkit, consume_voice_seconds


User = get_user_model()


class TrialAndVoiceBillingTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.provider = User.objects.create_user(
            username="bill-p3",
            email="bill-p3@example.com",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон",
            organization_address="ул. Тест, 1",
        )
        self.starter, _ = SubscriptionPlan.objects.get_or_create(
            slug="starter",
            defaults={
                "name": "Бесплатный",
                "description": "Free",
                "price_monthly": Decimal("0"),
                "plan_type": SubscriptionPlan.PlanType.FREE,
                "product_kind": SubscriptionPlan.ProductKind.PLATFORM,
                "features": ["Онлайн-запись", "Чаты"],
                "is_active": True,
                "sort_order": 1,
            },
        )
        self.business, _ = SubscriptionPlan.objects.get_or_create(
            slug="business",
            defaults={
                "name": "Бизнес",
                "description": "Paid",
                "price_monthly": Decimal("1990"),
                "plan_type": SubscriptionPlan.PlanType.PAID,
                "product_kind": SubscriptionPlan.ProductKind.PLATFORM,
                "features": ["Сотрудники", "Аналитика"],
                "is_active": True,
                "sort_order": 2,
            },
        )
        self.voice30, _ = SubscriptionPlan.objects.get_or_create(
            slug="voice-30",
            defaults={
                "name": "Голос 30",
                "description": "Voice",
                "price_monthly": Decimal("490"),
                "plan_type": SubscriptionPlan.PlanType.PAID,
                "product_kind": SubscriptionPlan.ProductKind.VOICE,
                "voice_minutes_monthly": 30,
                "features": ["30 минут SpeechKit"],
                "is_active": True,
                "sort_order": 10,
            },
        )
        # Ensure expected fields even if migration seed already created rows.
        SubscriptionPlan.objects.filter(pk=self.starter.pk).update(
            plan_type=SubscriptionPlan.PlanType.FREE,
            product_kind=SubscriptionPlan.ProductKind.PLATFORM,
            price_monthly=Decimal("0"),
            is_active=True,
        )
        SubscriptionPlan.objects.filter(pk=self.business.pk).update(
            plan_type=SubscriptionPlan.PlanType.PAID,
            product_kind=SubscriptionPlan.ProductKind.PLATFORM,
            price_monthly=Decimal("1990"),
            is_active=True,
        )
        SubscriptionPlan.objects.filter(pk=self.voice30.pk).update(
            plan_type=SubscriptionPlan.PlanType.PAID,
            product_kind=SubscriptionPlan.ProductKind.VOICE,
            voice_minutes_monthly=30,
            price_monthly=Decimal("490"),
            is_active=True,
        )
        self.starter.refresh_from_db()
        self.business.refresh_from_db()
        self.voice30.refresh_from_db()

    def test_activate_trial_once(self):
        req = self.factory.post("/api/subscriptions/trial/", {}, format="json")
        force_authenticate(req, user=self.provider)
        resp = ActivateTrialView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            UserSubscription.objects.filter(
                user=self.provider,
                plan=self.starter,
                status=UserSubscription.Status.ACTIVE,
            ).exists()
        )
        req2 = self.factory.post("/api/subscriptions/trial/", {}, format="json")
        force_authenticate(req2, user=self.provider)
        resp2 = ActivateTrialView.as_view()(req2)
        self.assertEqual(resp2.status_code, 400)

    def test_staff_gate_free_vs_business(self):
        self.assertFalse(provider_can_manage_staff(self.provider))
        sub = UserSubscription.objects.create(
            user=self.provider,
            plan=self.business,
            status=UserSubscription.Status.ACTIVE,
            source=UserSubscription.Source.PAID,
        )
        on_subscription_activated(sub)
        self.assertTrue(provider_can_manage_staff(self.provider))

    def test_voice_quota_apply_and_over_limit(self):
        apply_voice_quota_from_plan(self.provider, self.voice30)
        vs = ProviderVoiceSettings.objects.get(provider=self.provider)
        self.assertEqual(vs.voice_minutes_quota, Decimal("30"))
        self.assertTrue(can_use_speechkit(vs))
        self.assertTrue(consume_voice_seconds(vs, 60 * 29))
        vs.refresh_from_db()
        # 1 minute left — oversize debit is rejected, but access remains until exhausted.
        self.assertFalse(consume_voice_seconds(vs, 60 * 2))
        vs.refresh_from_db()
        self.assertTrue(can_use_speechkit(vs))
        self.assertTrue(consume_voice_seconds(vs, 60 * 1))
        vs.refresh_from_db()
        self.assertFalse(can_use_speechkit(vs))

    def test_renew_maps_free_to_business_without_yookassa(self):
        from django.test import override_settings

        sub = UserSubscription.objects.create(
            user=self.provider,
            plan=self.starter,
            status=UserSubscription.Status.ACTIVE,
            source=UserSubscription.Source.TRIAL,
        )
        req = self.factory.post(
            "/api/subscriptions/renew/",
            {"subscription_id": sub.id},
            format="json",
        )
        force_authenticate(req, user=self.provider)
        # Prod-like: no YooKassa → fail after free→business remap (not "free without payment").
        with override_settings(DEBUG=False, YOOKASSA_SHOP_ID="", YOOKASSA_SECRET_KEY=""):
            resp = RenewSubscriptionView.as_view()(req)
        self.assertIn(resp.status_code, (400, 503))
        detail = str(resp.data.get("detail") or "")
        self.assertNotIn("Бесплатный тариф активируется без оплаты", detail)
        self.assertIn("ЮKassa", detail)
