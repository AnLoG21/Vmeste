"""HTTP: seed provider catalog from sphere template."""

from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Service
from users.models import User


class CatalogSeedApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-catalog-seed",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Seed",
        )
        self.api.force_authenticate(self.provider)

    def test_get_status_empty(self):
        res = self.api.get("/api/catalog/seed-catalog/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("sphere"), "hair_salon")
        self.assertTrue(res.data.get("has_template"))
        self.assertFalse(res.data.get("catalog_seeded"))
        self.assertEqual(res.data.get("total_services"), 0)

    def test_post_seeds_services(self):
        res = self.api.post(
            "/api/catalog/seed-catalog/",
            {"sphere": "hair_salon"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("catalog_seeded"))
        self.assertGreater(res.data.get("total_services") or 0, 0)
        self.assertGreater(res.data.get("stats", {}).get("services") or 0, 0)
        self.assertGreater(Service.objects.filter(provider=self.provider).count(), 0)
        # Seeded services start inactive until provider enables them.
        self.assertEqual(Service.objects.filter(provider=self.provider, is_active=True).count(), 0)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-no-seed",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.post(
            "/api/catalog/seed-catalog/",
            {"sphere": "hair_salon"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
