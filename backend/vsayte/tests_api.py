from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from subscriptions.models import SubscriptionPlan, UserSubscription
from vsayte.models import Site, SiteDomain


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
        self.assertFalse(res.data.get("full_access"))
        self.assertEqual(res.data["limits"]["plan_slug"], "vsayte-free")

    def test_entitlement_full_access_allowlist(self):
        user = User.objects.create_user(
            username="a.loginov150",
            email="loginov@test.local",
            password="pass12345",
        )
        client = APIClient()
        client.force_authenticate(user)
        res = client.get("/api/vsayte/entitlement/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["full_access"])
        self.assertTrue(res.data["can_publish"])
        self.assertTrue(res.data["can_custom_domain"])
        self.assertEqual(res.data["editor_tier"], "pro")
        self.assertEqual(res.data["limits"]["plan_slug"], "vsayte-pro")

    def test_create_site_and_block_publish_on_free(self):
        res = self.client.post(
            "/api/vsayte/sites/",
            {"title": "Demo", "document": {"html": "<h1>Hi</h1>", "css": ""}},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data.get("slug"))
        site_id = res.data["id"]
        pub = self.client.post(f"/api/vsayte/sites/{site_id}/publish/")
        self.assertEqual(pub.status_code, 403)

    def test_create_site_without_slug_autogenerates(self):
        res = self.client.post(
            "/api/vsayte/sites/",
            {"title": "Новый сайт", "template_id": "landing", "document": {"html": "", "css": ""}},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["title"], "Новый сайт")
        self.assertTrue(res.data["slug"])

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

    @override_settings(VSAYTE_SITES_ROOT="/tmp/vsayte-test-sites")
    def test_public_lead_on_published_site(self):
        plan = SubscriptionPlan.objects.get(slug="vsayte-hosting")
        UserSubscription.objects.create(
            user=self.user,
            plan=plan,
            status=UserSubscription.Status.ACTIVE,
            source=UserSubscription.Source.PAID,
        )
        site = Site.objects.create(
            owner=self.user,
            title="Leads",
            slug="leads-demo",
            document={"html": "<form class='vs-lead-form'></form>", "css": ""},
            status=Site.Status.PUBLISHED,
        )
        anon = APIClient()
        blocked = anon.post(
            "/api/vsayte/public/leads-demo/leads/",
            {"name": "Ann", "contact": "+7000", "message": "Hi"},
            format="json",
        )
        # status already published above — should accept
        self.assertEqual(blocked.status_code, 201)
        listed = self.client.get(f"/api/vsayte/sites/{site.id}/leads/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0]["contact"], "+7000")

    def test_public_lead_cors_allows_active_custom_domain(self):
        site = Site.objects.create(
            owner=self.user,
            title="Custom",
            slug="custom-lead",
            document={"html": "", "css": ""},
            status=Site.Status.PUBLISHED,
        )
        SiteDomain.objects.create(
            site=site,
            kind=SiteDomain.Kind.CUSTOM,
            hostname="shop.example.com",
            status=SiteDomain.Status.ACTIVE,
        )
        anon = APIClient()
        origin = "https://shop.example.com"
        options = anon.options(
            "/api/vsayte/public/custom-lead/leads/",
            HTTP_ORIGIN=origin,
        )
        self.assertEqual(options.status_code, 204)
        self.assertEqual(options["Access-Control-Allow-Origin"], origin)
        post = anon.post(
            "/api/vsayte/public/custom-lead/leads/",
            {"name": "Bob", "contact": "b@ex.com", "message": "Want"},
            format="json",
            HTTP_ORIGIN=origin,
        )
        self.assertEqual(post.status_code, 201)
        self.assertEqual(post["Access-Control-Allow-Origin"], origin)

        denied = anon.post(
            "/api/vsayte/public/custom-lead/leads/",
            {"name": "Eve", "contact": "e@ex.com", "message": "Nope"},
            format="json",
            HTTP_ORIGIN="https://evil.example",
        )
        self.assertEqual(denied.status_code, 201)
        self.assertNotIn("Access-Control-Allow-Origin", denied)
