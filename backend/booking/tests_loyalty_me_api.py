"""HTTP: client/provider loyalty me + accounts + package self-purchase."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from booking.loyalty import get_or_create_loyalty_account, get_or_create_loyalty_settings
from booking.models import ClientPackage, VisitPackage


class LoyaltyMeApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-loyalty-me",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Loyalty Me",
        )
        self.client_user = User.objects.create_user(
            username="client-loyalty-me",
            password="x",
            role=User.Role.CLIENT,
        )
        settings = get_or_create_loyalty_settings(self.provider)
        settings.enabled = True
        settings.rub_per_point = Decimal("2.00")
        settings.welcome_bonus = 0
        settings.save()
        account = get_or_create_loyalty_account(self.provider, self.client_user)
        account.balance = 250
        account.save(update_fields=["balance", "updated_at"])
        self.package = VisitPackage.objects.create(
            provider=self.provider,
            name="5 стрижек",
            visits_count=5,
            price=Decimal("4000.00"),
            validity_days=90,
            is_active=True,
        )

    def test_client_accounts_list(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/booking/loyalty/accounts/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["provider"], self.provider.id)
        self.assertEqual(res.data[0]["balance"], 250)
        self.assertEqual(res.data[0]["level"], "gold")

    def test_client_me_by_provider(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get(f"/api/booking/loyalty/me/?provider={self.provider.id}")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["balance"], 250)
        self.assertTrue(res.data["enabled"])
        self.assertEqual(str(res.data["rub_per_point"]), "2.00")

    def test_client_me_all_accounts(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/booking/loyalty/me/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["balance"], 250)

    def test_provider_lookup_by_client_login(self):
        self.api.force_authenticate(self.provider)
        res = self.api.get(f"/api/booking/loyalty/me/?client={self.client_user.username}")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["client"], self.client_user.id)
        self.assertEqual(res.data["balance"], 250)

    def test_provider_forbidden_on_accounts(self):
        self.api.force_authenticate(self.provider)
        res = self.api.get("/api/booking/loyalty/accounts/")
        self.assertEqual(res.status_code, 403)

    def test_client_purchase_package(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.post(f"/api/booking/packages/{self.package.id}/purchase/", {}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["package_name"], "5 стрижек")
        self.assertEqual(res.data["visits_remaining"], 5)
        self.assertEqual(res.data["status"], ClientPackage.Status.ACTIVE)
        self.assertEqual(
            ClientPackage.objects.filter(client=self.client_user, package=self.package).count(),
            1,
        )
