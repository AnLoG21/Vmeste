"""HTTP: clients lookup + create in org base."""

from django.test import TestCase
from rest_framework.test import APIClient

from booking.models import ProviderClientCard
from booking.phone_clients import touch_provider_client_card
from users.models import User


class ClientsLookupApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-clients-lookup",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Clients",
        )
        self.client_user = User.objects.create_user(
            username="client-in-base",
            password="x",
            role=User.Role.CLIENT,
            first_name="Ольга",
            last_name="База",
            phone="+79005551122",
        )
        touch_provider_client_card(self.provider.id, self.client_user)
        self.api.force_authenticate(self.provider)

    def test_lookup_by_name(self):
        res = self.api.get("/api/booking/clients/lookup/?q=Ольга")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("found"))
        self.assertGreaterEqual(len(res.data.get("results") or []), 1)
        self.assertIn("Ольга", (res.data["results"][0].get("name") or ""))

    def test_lookup_by_phone(self):
        res = self.api.get("/api/booking/clients/lookup/?q=9005551122")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("found"))

    def test_create_client(self):
        res = self.api.post(
            "/api/booking/clients/",
            {"name": "Новый Клиент", "phone": "+79003334455"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data.get("id"))
        self.assertTrue(
            ProviderClientCard.objects.filter(provider=self.provider, client_id=res.data["id"]).exists()
        )

    def test_list_clients(self):
        res = self.api.get("/api/booking/clients/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertGreaterEqual(res.data.get("count") or 0, 1)
