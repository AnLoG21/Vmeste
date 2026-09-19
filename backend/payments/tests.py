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

    @override_settings(FRONTEND_URL="https://vsevmeste.space")
    @patch("payments.gateway.yookassa_create")
    def test_create_org_payment_yookassa(self, mock_yk):
        mock_yk.return_value = {
            "id": "yk-1",
            "status": "pending",
            "confirmation": {"confirmation_url": "https://yookassa.test/pay"},
        }
        out = create_org_payment(
            provider_code="yookassa",
            creds={"shop_id": "shop", "secret_key": "secret"},
            amount="150.00",
            description="Тест ЮKassa",
            return_url="https://vsevmeste.space/pay/return",
            order_id="ord-yk-1",
            metadata={"kind": "booking"},
        )
        self.assertIsNotNone(out)
        self.assertEqual(out["id"], "yk-1")
        self.assertEqual(out["provider"], "yookassa")
        self.assertEqual(out["confirmation_url"], "https://yookassa.test/pay")
        mock_yk.assert_called_once()

    @override_settings(FRONTEND_URL="https://vsevmeste.space")
    @patch("payments.gateway._cloudpayments_create")
    def test_create_org_payment_cloudpayments(self, mock_cp):
        mock_cp.return_value = {
            "id": "cp-1",
            "confirmation_url": "https://cloudpayments.test/pay",
            "provider": "cloudpayments",
        }
        out = create_org_payment(
            provider_code="cloudpayments",
            creds={"public_id": "pk", "api_secret": "sec"},
            amount="200.00",
            description="Тест CP",
            return_url="https://vsevmeste.space/pay/return",
            order_id="ord-cp-1",
            metadata={"kind": "shop"},
        )
        self.assertIsNotNone(out)
        self.assertEqual(out["id"], "cp-1")
        self.assertEqual(out["provider"], "cloudpayments")
        mock_cp.assert_called_once()

    @override_settings(FRONTEND_URL="https://vsevmeste.space")
    def test_create_org_payment_robokassa(self):
        out = create_org_payment(
            provider_code="robokassa",
            creds={"merchant_login": "demo", "password1": "pass1", "password2": "pass2"},
            amount="99.00",
            description="Тест Robokassa",
            return_url="https://vsevmeste.space/pay/return",
            order_id="42",
            metadata={"kind": "sub"},
        )
        self.assertIsNotNone(out)
        self.assertEqual(out["provider"], "robokassa")
        self.assertEqual(out["id"], "42")
        self.assertIn("auth.robokassa.ru", out["confirmation_url"])
        self.assertIn("SignatureValue=", out["confirmation_url"])
