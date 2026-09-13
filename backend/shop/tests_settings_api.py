"""HTTP: shop provider settings GET/PATCH."""

from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import ShopSettings
from users.models import User


class ShopSettingsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="shop-settings-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Магазин Settings",
            organization_slug="shop-settings-api",
        )
        self.api.force_authenticate(self.provider)

    def test_get_and_patch_modes(self):
        got = self.api.get("/api/shop/settings/")
        self.assertEqual(got.status_code, 200, got.data)
        self.assertIn("enable_delivery", got.data)
        self.assertIn("accept_online_payment", got.data)
        self.assertIn("enable_pickup", got.data)
        self.assertTrue(ShopSettings.objects.filter(provider=self.provider).exists())

        patched = self.api.patch(
            "/api/shop/settings/",
            {"enable_delivery": True, "accept_online_payment": True},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertTrue(patched.data.get("enable_delivery"))
        self.assertTrue(patched.data.get("accept_online_payment"))

        settings = ShopSettings.objects.get(provider=self.provider)
        self.assertTrue(settings.enable_delivery)
        self.assertTrue(settings.accept_online_payment)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-shop-settings",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.get("/api/shop/settings/")
        self.assertEqual(res.status_code, 403)
