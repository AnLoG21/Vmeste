"""Payments helpers — no DB required."""

from django.test import SimpleTestCase

from payments.gateway import provider_ready


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

    def test_unknown_provider(self):
        self.assertFalse(provider_ready("unknown", {"shop_id": "1", "secret_key": "x"}))
