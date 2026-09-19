"""Unit: common.ops_alerts.alert_ops."""

from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from common.ops_alerts import alert_ops


class OpsAlertsTests(SimpleTestCase):
    @override_settings(OPS_ALERT_WEBHOOK_URL="")
    @patch("common.ops_alerts.urllib.request.urlopen")
    def test_no_url_is_noop(self, mock_open):
        alert_ops("deploy_failed", "boom")
        mock_open.assert_not_called()

    @override_settings(OPS_ALERT_WEBHOOK_URL="https://hooks.example/ops")
    @patch("common.ops_alerts.urllib.request.urlopen")
    def test_posts_webhook(self, mock_open):
        resp = MagicMock()
        resp.read.return_value = b"ok"
        resp.__enter__.return_value = resp
        resp.__exit__.return_value = False
        mock_open.return_value = resp

        alert_ops("speechkit_down", "timeout", extra={"code": 503})
        mock_open.assert_called_once()
        req = mock_open.call_args[0][0]
        self.assertEqual(req.full_url, "https://hooks.example/ops")
        body = req.data.decode("utf-8")
        self.assertIn("speechkit_down", body)
        self.assertIn("timeout", body)
