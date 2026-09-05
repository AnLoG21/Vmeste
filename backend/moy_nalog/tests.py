from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from moy_nalog.client import MoyNalogClient, NpdMaybeSent, NpdUnreachable
from moy_nalog.crypto import decrypt_secret, encrypt_secret
from moy_nalog.models import MoyNalogAccount, NpdReceipt
from moy_nalog.service import normalize_inn, normalize_phone, _claim_receipt, _issue_claimed
from moy_nalog.crypto import encrypt_secret as enc


class CryptoTests(SimpleTestCase):
    def test_roundtrip(self):
        raw = "refresh-token-secret"
        stored = encrypt_secret(raw)
        self.assertTrue(stored.startswith("enc:"))
        self.assertNotEqual(stored, raw)
        self.assertEqual(decrypt_secret(stored), raw)


class NormalizeTests(SimpleTestCase):
    def test_phone(self):
        self.assertEqual(normalize_phone("+7 (999) 111-22-33"), "79991112233")
        self.assertEqual(normalize_phone("89991112233"), "79991112233")

    def test_inn(self):
        self.assertEqual(normalize_inn("9715 0075 9750"), "971500759750")


class ClaimAndIssueTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.provider = User.objects.create_user(
            username="npd-prov",
            email="npd@example.com",
            password="x",
            role="provider",
        )
        MoyNalogAccount.objects.create(
            provider=self.provider,
            inn="971500759750",
            device_id="testdeviceid123456789",
            refresh_token_enc=enc("refresh"),
            access_token_enc=enc("access"),
            enabled=True,
        )

    def test_claim_once(self):
        r1 = _claim_receipt(
            provider=self.provider,
            source=NpdReceipt.Source.BOOKING,
            source_id=42,
            amount=Decimal("100.00"),
            service_name="Стрижка",
            operation_time=None,
        )
        self.assertIsNotNone(r1)
        self.assertEqual(r1.status, NpdReceipt.Status.PENDING)
        r2 = _claim_receipt(
            provider=self.provider,
            source=NpdReceipt.Source.BOOKING,
            source_id=42,
            amount=Decimal("100.00"),
            service_name="Стрижка",
            operation_time=None,
        )
        self.assertIsNone(r2)

    @patch.object(MoyNalogClient, "create_income", return_value="uuid-abc")
    @patch.object(MoyNalogClient, "ensure_access")
    def test_issue_success(self, _ensure, _create):
        receipt = _claim_receipt(
            provider=self.provider,
            source=NpdReceipt.Source.BOOKING,
            source_id=7,
            amount=Decimal("250.50"),
            service_name="Услуга",
            operation_time=None,
        )
        out = _issue_claimed(receipt)
        self.assertEqual(out.status, NpdReceipt.Status.ISSUED)
        self.assertEqual(out.receipt_uuid, "uuid-abc")
        self.assertIn("uuid-abc", out.receipt_url)

    @patch.object(MoyNalogClient, "create_income", side_effect=NpdMaybeSent("timeout"))
    @patch.object(MoyNalogClient, "ensure_access")
    def test_issue_maybe(self, _ensure, _create):
        receipt = _claim_receipt(
            provider=self.provider,
            source=NpdReceipt.Source.BOOKING,
            source_id=8,
            amount=Decimal("10.00"),
            service_name="Услуга",
            operation_time=None,
        )
        out = _issue_claimed(receipt)
        self.assertEqual(out.status, NpdReceipt.Status.MAYBE)

    @patch.object(MoyNalogClient, "create_income", side_effect=NpdUnreachable("down"))
    @patch.object(MoyNalogClient, "ensure_access")
    def test_issue_unreachable_retryable(self, _ensure, _create):
        receipt = _claim_receipt(
            provider=self.provider,
            source=NpdReceipt.Source.BOOKING,
            source_id=9,
            amount=Decimal("10.00"),
            service_name="Услуга",
            operation_time=None,
        )
        out = _issue_claimed(receipt)
        self.assertEqual(out.status, NpdReceipt.Status.FAILED)
