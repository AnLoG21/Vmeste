from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from subscriptions.models import SubscriptionPlan, UserSubscription
from vsayte.models import Site


User = get_user_model()


class VsayteApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="vsayte@test.local", password="pass12345")
        SubscriptionPlan.objects.update_or_create(
            slug="vsayte-free",
            defaults={
                "name": "Free",
                "price_monthly": 0,
                "plan_type": SubscriptionPlan.PlanType.FREE,
                "product_kind": SubscriptionPlan.ProductKind.VSAYTE,
                "is_active": True,
            },
        )
        SubscriptionPlan.objects.update_or_create(
            slug="vsayte-hosting",
            defaults={
                "name": "Hosting",
                "price_monthly": 300,
                "plan_type": SubscriptionPlan.PlanType.PAID,
                "product_kind": SubscriptionPlan.ProductKind.VSAYTE,
                "is_active": True,
            },
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_entitlement_grants_free(self):
        res = self.client.get("/api/vsayte/entitlement/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["can_publish"])
        self.assertEqual(res.data["limits"]["plan_slug"], "vsayte-free")

    def test_create_site_and_block_publish_on_free(self):
        res = self.client.post(
            "/api/vsayte/sites/",
            {"title": "Demo", "document": {"html": "<h1>Hi</h1>", "css": ""}},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        site_id = res.data["id"]
        pub = self.client.post(f"/api/vsayte/sites/{site_id}/publish/")
        self.assertEqual(pub.status_code, 403)

    @override_settings(VSAYTE_SITES_ROOT="/tmp/vsayte-test-sites")
    def test_publish_on_hosting(self):
        plan = SubscriptionPlan.objects.get(slug="vsayte-hosting")
        UserSubscription.objects.create(
            user=self.user,
            plan=plan,
            status=UserSubscription.Status.ACTIVE,
            source=UserSubscription.Source.PAID,
        )
        site = Site.objects.create(
            owner=self.user,
            title="Live",
            slug="live-demo",
            document={"html": "<h1>Live</h1>", "css": "h1{color:red}"},
        )
        pub = self.client.post(f"/api/vsayte/sites/{site.id}/publish/")
        self.assertEqual(pub.status_code, 200)
        site.refresh_from_db()
        self.assertEqual(site.status, Site.Status.PUBLISHED)
