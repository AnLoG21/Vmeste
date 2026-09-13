"""HTTP: provider acquiring settings GET/PATCH."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from booking.acquiring import get_or_create_acquiring
from booking.models import ProviderAcquiring


class AcquiringSettingsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-acquiring-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Acquiring",
        )
        self.client_user = User.objects.create_user(
            username="client-acquiring-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(self.provider)

    def test_get_acquiring(self):
        res = self.api.get("/api/booking/acquiring/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("prepay_mode", res.data)
        self.assertIn("payment_provider", res.data)

    def test_patch_prepay_percent(self):
        res = self.api.patch(
            "/api/booking/acquiring/",
            {
                "payment_provider": "yookassa",
                "prepay_mode": ProviderAcquiring.PrepayMode.PERCENT,
                "prepay_percent": 30,
                "yookassa_shop_id": "shop-1",
                "yookassa_secret_key": "secret-1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["prepay_mode"], ProviderAcquiring.PrepayMode.PERCENT)
        self.assertEqual(res.data["prepay_percent"], 30)
        self.assertTrue(res.data["has_yookassa"])
        acq = get_or_create_acquiring(self.provider)
        self.assertEqual(acq.prepay_percent, 30)
        self.assertEqual(acq.yookassa_shop_id, "shop-1")

    def test_client_forbidden(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/booking/acquiring/")
        self.assertEqual(res.status_code, 403)
