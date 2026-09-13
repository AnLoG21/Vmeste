"""HTTP: MoyNalog status / enable / disconnect / receipts list."""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import User

from moy_nalog.crypto import encrypt_secret
from moy_nalog.models import MoyNalogAccount, NpdReceipt


class MoyNalogApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-moy-nalog-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон NPD",
        )
        self.client_user = User.objects.create_user(
            username="client-moy-nalog-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(self.provider)

    def test_status_disconnected(self):
        res = self.api.get("/api/moy-nalog/status/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data.get("connected"))

    def test_enable_without_account_400(self):
        res = self.api.patch("/api/moy-nalog/status/", {"enabled": True}, format="json")
        self.assertEqual(res.status_code, 400, res.data)

    def test_enable_and_disconnect(self):
        MoyNalogAccount.objects.create(
            provider=self.provider,
            inn="971500759750",
            device_id="testdeviceid12345678901",
            refresh_token_enc=encrypt_secret("refresh"),
            access_token_enc=encrypt_secret("access"),
            enabled=False,
            connected_at=timezone.now(),
        )
        enabled = self.api.patch("/api/moy-nalog/status/", {"enabled": True}, format="json")
        self.assertEqual(enabled.status_code, 200, enabled.data)
        self.assertTrue(enabled.data.get("connected"))
        self.assertTrue(enabled.data.get("enabled"))

        disconnected = self.api.post("/api/moy-nalog/disconnect/", {}, format="json")
        self.assertEqual(disconnected.status_code, 200, disconnected.data)
        self.assertFalse(disconnected.data.get("connected"))
        self.assertFalse(disconnected.data.get("enabled"))

    def test_receipts_list(self):
        MoyNalogAccount.objects.create(
            provider=self.provider,
            inn="971500759750",
            device_id="testdeviceid12345678901",
            refresh_token_enc=encrypt_secret("refresh"),
            access_token_enc=encrypt_secret("access"),
            enabled=True,
            connected_at=timezone.now(),
        )
        NpdReceipt.objects.create(
            provider=self.provider,
            source=NpdReceipt.Source.BOOKING,
            source_id=1,
            amount="100.00",
            service_name="Стрижка",
            status=NpdReceipt.Status.ISSUED,
        )
        res = self.api.get("/api/moy-nalog/receipts/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0].get("status"), NpdReceipt.Status.ISSUED)

    def test_client_forbidden(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/moy-nalog/status/")
        self.assertEqual(res.status_code, 403)
