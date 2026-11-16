"""Marketplace API health structural checks + email wiring."""

from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from marketplaces.health import health_alert_email, run_marketplace_api_health, structural_audit


class MarketplaceHealthStructuralTests(SimpleTestCase):
    def test_structural_audit_passes(self):
        checks = structural_audit()
        fails = [c for c in checks if not c.get("ok")]
        self.assertEqual(fails, [], fails)

    @override_settings(MARKETPLACE_HEALTH_EMAIL="", SUPPORT_EMAIL="vmesteofficialsupport@gmail.com")
    def test_alert_email_defaults_to_support(self):
        self.assertEqual(health_alert_email(), "vmesteofficialsupport@gmail.com")

    @override_settings(MARKETPLACE_HEALTH_EMAIL="ops@example.com")
    def test_alert_email_override(self):
        self.assertEqual(health_alert_email(), "ops@example.com")

    @patch("marketplaces.health.MarketplaceSettings.objects")
    def test_run_without_accounts_is_ok(self, mock_objects):
        mock_objects.filter.return_value.select_related.return_value.order_by.return_value = []
        report = run_marketplace_api_health()
        self.assertTrue(report["ok"])
        self.assertEqual(report["probed_accounts"], 0)
