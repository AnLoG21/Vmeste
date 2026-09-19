"""Payments helpers — provider_ready + mocked create_org_payment."""

from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from payments.gateway import create_org_payment, provider_ready


class PaymentGatewayReadyTests(SimpleTestCase):
    def test_yookassa_ready(self):
        self.assertFalse(provider_ready("yookassa", {}))
        self.assertTrue(
            provider_ready("yookassa", {"shop_id": "1", "secret_key": "secret"}),
        )

    def test_tbank_ready(self):
        self.assertFalse(provider_ready("tbank", {"terminal_key": "t"}))
        self.assertTrue(
            provider_ready("tbank", {"terminal_key": "t", "password": "p"}),
        )

    def test_cloudpayments_ready(self):
        self.assertFalse(provider_ready("cloudpayments", {"public_id": "pk"}))
        self.assertTrue(
            provider_ready("cloudpayments", {"public_id": "pk", "api_secret": "sec"}),
        )

    def test_robokassa_ready(self):
        self.assertFalse(provider_ready("robokassa", {"merchant_login": "m", "password1": "p1"}))
        self.assertTrue(
            provider_ready(
                "robokassa",
                {"merchant_login": "m", "password1": "p1", "password2": "p2"},
            ),
        )

    def test_unknown_provider(self):
        self.assertFalse(provider_ready("unknown", {"shop_id": "1", "secret_key": "x"}))


class PaymentCreateOrgPaymentTests(SimpleTestCase):
    @override_settings(FRONTEND_URL="https://vsevmeste.space")
    @patch("payments.gateway._tbank_init")
    def test_create_org_payment_tbank(self, mock_init):
        mock_init.return_value = {
            "id": "tb-1",
            "confirmation_url": "https://pay.tbank.test/pay",
            "provider": "tbank",
            "status": "pending",
        }
        out = create_org_payment(
            provider_code="tbank",
            creds={"terminal_key": "term", "password": "secret"},
            amount="100.00",
            description="Тест",
            return_url="https://vsevmeste.space/subscriptions?payment=success",
            order_id="ord-1",
            metadata={"kind": "subscription"},
        )
        self.assertIsNotNone(out)
        self.assertEqual(out["id"], "tb-1")
        self.assertEqual(out["provider"], "tbank")
        mock_init.assert_called_once()
