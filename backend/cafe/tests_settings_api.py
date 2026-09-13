"""HTTP: cafe provider settings GET/PATCH."""

from django.test import TestCase
from rest_framework.test import APIClient

from cafe.models import CafeSettings
from users.models import User


class CafeSettingsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="cafe-settings-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.CAFE_RESTAURANT,
            organization_name="Кафе Settings",
            organization_slug="cafe-settings-api",
        )
        self.api.force_authenticate(self.provider)

    def test_get_and_patch_modes(self):
        got = self.api.get("/api/cafe/settings/")
        self.assertEqual(got.status_code, 200, got.data)
        self.assertIn("enable_delivery", got.data)
        self.assertIn("accept_online_payment", got.data)
        self.assertTrue(CafeSettings.objects.filter(provider=self.provider).exists())

        patched = self.api.patch(
            "/api/cafe/settings/",
            {"enable_delivery": True, "accept_online_payment": True},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertTrue(patched.data.get("enable_delivery"))
        self.assertTrue(patched.data.get("accept_online_payment"))

        settings = CafeSettings.objects.get(provider=self.provider)
        self.assertTrue(settings.enable_delivery)
        self.assertTrue(settings.accept_online_payment)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-cafe-settings",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.get("/api/cafe/settings/")
        self.assertEqual(res.status_code, 403)
