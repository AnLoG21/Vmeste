"""HTTP: provider creates branch location."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from locations.models import ProviderLocation
from users.models import User


class LocationBranchApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-branch-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Branch",
        )
        self.api.force_authenticate(self.provider)

    def test_create_branch(self):
        res = self.api.post(
            "/api/locations/",
            {
                "title": "Филиал Север",
                "address": "Москва, ул. Северная, 1",
                "latitude": "55.800000",
                "longitude": "37.600000",
                "entrance": "2",
                "floor": "1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("title"), "Филиал Север")
        loc = ProviderLocation.objects.get(provider=self.provider)
        self.assertEqual(loc.title, "Филиал Север")
        self.assertEqual(loc.entrance, "2")
        self.assertEqual(loc.latitude, Decimal("55.800000"))

    def test_client_cannot_create(self):
        client = User.objects.create_user(
            username="client-no-branch",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.post(
            "/api/locations/",
            {
                "title": "X",
                "address": "Y",
                "latitude": "55.75",
                "longitude": "37.62",
            },
            format="json",
        )
        self.assertIn(res.status_code, (403, 401))

    def test_list_own_branches(self):
        ProviderLocation.objects.create(
            provider=self.provider,
            title="Точка 1",
            address="Адрес 1",
            latitude=Decimal("55.75"),
            longitude=Decimal("37.62"),
        )
        res = self.api.get("/api/locations/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["title"], "Точка 1")

    def test_patch_and_delete_branch(self):
        loc = ProviderLocation.objects.create(
            provider=self.provider,
            title="Старый",
            address="Адрес старый",
            latitude=Decimal("55.75"),
            longitude=Decimal("37.62"),
        )
        patch = self.api.patch(
            f"/api/locations/{loc.id}/",
            {"title": "Новый филиал", "address": "Адрес новый"},
            format="json",
        )
        self.assertEqual(patch.status_code, 200, patch.data)
        loc.refresh_from_db()
        self.assertEqual(loc.title, "Новый филиал")
        self.assertEqual(loc.address, "Адрес новый")

        deleted = self.api.delete(f"/api/locations/{loc.id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(ProviderLocation.objects.filter(pk=loc.id).exists())
