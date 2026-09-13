"""HTTP: provider loyalty settings GET/PATCH + create/sell visit package."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from booking.loyalty import get_or_create_loyalty_settings
from booking.models import ClientPackage, VisitPackage


class LoyaltySettingsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-loyalty-settings",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Settings",
        )
        self.client_user = User.objects.create_user(
            username="client-loyalty-settings",
            password="x",
            role=User.Role.CLIENT,
        )
        get_or_create_loyalty_settings(self.provider)

    def test_provider_get_settings(self):
        self.api.force_authenticate(self.provider)
        res = self.api.get("/api/booking/loyalty/settings/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("enabled", res.data)
        self.assertIn("rub_per_point", res.data)

    def test_provider_patch_settings(self):
        self.api.force_authenticate(self.provider)
        res = self.api.patch(
            "/api/booking/loyalty/settings/",
            {
                "enabled": True,
                "points_per_visit": 3,
                "points_per_100_rub": 1,
                "rub_per_point": "2.50",
                "welcome_bonus": 10,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["enabled"])
        self.assertEqual(res.data["points_per_visit"], 3)
        self.assertEqual(str(res.data["rub_per_point"]), "2.50")
        self.assertEqual(res.data["welcome_bonus"], 10)

    def test_client_forbidden_on_settings(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/booking/loyalty/settings/")
        self.assertEqual(res.status_code, 403)

    def test_provider_create_and_sell_package(self):
        self.api.force_authenticate(self.provider)
        created = self.api.post(
            "/api/booking/packages/",
            {
                "name": "10 стрижек",
                "visits_count": 10,
                "price": "7000.00",
                "validity_days": 120,
                "service_ids": [],
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        pkg_id = created.data["id"]
        self.assertEqual(VisitPackage.objects.filter(pk=pkg_id, provider=self.provider).count(), 1)

        sold = self.api.post(
            "/api/booking/client-packages/",
            {"package": pkg_id, "client": self.client_user.username, "note": "E2E"},
            format="json",
        )
        self.assertEqual(sold.status_code, 201, sold.data)
        self.assertEqual(sold.data["package_name"], "10 стрижек")
        self.assertEqual(sold.data["visits_remaining"], 10)
        self.assertEqual(sold.data["status"], ClientPackage.Status.ACTIVE)
        self.assertEqual(
            ClientPackage.objects.filter(client=self.client_user, package_id=pkg_id).count(),
            1,
        )
