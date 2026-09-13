"""HTTP: client base migrate-request GET/POST."""

from django.test import TestCase
from rest_framework.test import APIClient

from booking.models import ClientMigrateRequest
from users.models import User


class ClientsMigrateApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-clients-migrate",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Migrate",
        )
        self.api.force_authenticate(self.provider)

    def test_get_empty_then_post_note(self):
        empty = self.api.get("/api/booking/clients/migrate-request/")
        self.assertEqual(empty.status_code, 200, empty.data)
        self.assertEqual(empty.data.get("results"), [])
        self.assertIsNone(empty.data.get("latest"))

        created = self.api.post(
            "/api/booking/clients/migrate-request/",
            {"source_note": "YCLIENTS, около 200 клиентов"},
            format="multipart",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data.get("status"), "new")
        self.assertEqual(created.data.get("status_label"), "Новая")
        self.assertIn("YCLIENTS", created.data.get("source_note") or "")

        self.assertEqual(ClientMigrateRequest.objects.filter(provider=self.provider).count(), 1)

        listed = self.api.get("/api/booking/clients/migrate-request/")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data.get("results") or []), 1)
        self.assertEqual(listed.data.get("latest", {}).get("status"), "new")

    def test_post_requires_file_or_note(self):
        res = self.api.post("/api/booking/clients/migrate-request/", {}, format="multipart")
        self.assertEqual(res.status_code, 400, res.data)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-migrate-forbid",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.get("/api/booking/clients/migrate-request/")
        self.assertEqual(res.status_code, 403)
