"""HTTP: marketplace provider settings GET/PATCH (notify flags + environment/keys)."""

from django.test import TestCase
from rest_framework.test import APIClient

from marketplaces.models import MarketplaceSettings
from users.models import User


class MarketplaceSettingsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="mp-settings-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.MARKETPLACES,
            organization_name="МП Settings",
            organization_slug="mp-settings-api",
        )
        self.api.force_authenticate(self.provider)

    def test_get_and_patch_notify(self):
        got = self.api.get("/api/marketplaces/settings/")
        self.assertEqual(got.status_code, 200, got.data)
        self.assertIn("notify_telegram", got.data)
        self.assertIn("notify_push", got.data)
        self.assertIn("notify_on_new_orders", got.data)
        self.assertIn("notify_on_sync_errors", got.data)
        self.assertTrue(MarketplaceSettings.objects.filter(provider=self.provider).exists())

        patched = self.api.patch(
            "/api/marketplaces/settings/",
            {
                "notify_telegram": False,
                "notify_push": True,
                "notify_on_new_orders": False,
                "notify_on_sync_errors": True,
            },
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertFalse(patched.data.get("notify_telegram"))
        self.assertTrue(patched.data.get("notify_push"))
        self.assertFalse(patched.data.get("notify_on_new_orders"))
        self.assertTrue(patched.data.get("notify_on_sync_errors"))

        settings = MarketplaceSettings.objects.get(provider=self.provider)
        self.assertFalse(settings.notify_telegram)
        self.assertTrue(settings.notify_push)
        self.assertFalse(settings.notify_on_new_orders)
        self.assertTrue(settings.notify_on_sync_errors)

    def test_patch_environment_and_keys(self):
        patched = self.api.patch(
            "/api/marketplaces/settings/",
            {
                "environment": "prod",
                "ozon_client_id": "e2e-ozon-client",
                "ozon_api_key": "ozon-secret-key",
                "wb_api_key": "wb-secret-key",
            },
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertEqual(patched.data.get("environment"), "prod")
        self.assertTrue(patched.data.get("has_ozon_api_key"))
        self.assertTrue(patched.data.get("has_wb_api_key"))
        self.assertNotIn("ozon_api_key", patched.data)
        self.assertNotIn("wb_api_key", patched.data)

        settings = MarketplaceSettings.objects.get(provider=self.provider)
        self.assertEqual(settings.environment, "prod")
        self.assertEqual(settings.ozon_client_id, "e2e-ozon-client")
        self.assertEqual(settings.ozon_api_key, "ozon-secret-key")
        self.assertEqual(settings.wb_api_key, "wb-secret-key")

        got = self.api.get("/api/marketplaces/settings/")
        self.assertEqual(got.status_code, 200, got.data)
        self.assertEqual(got.data.get("environment"), "prod")
        self.assertTrue(got.data.get("has_ozon_api_key"))
        self.assertTrue(got.data.get("has_wb_api_key"))
        self.assertNotIn("ozon_api_key", got.data)
        self.assertNotIn("wb_api_key", got.data)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-mp-settings",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.get("/api/marketplaces/settings/")
        self.assertEqual(res.status_code, 403)
