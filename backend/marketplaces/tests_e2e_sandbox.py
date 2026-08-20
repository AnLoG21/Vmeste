"""Sandbox / mocked e2e-style flows for marketplaces (no live Ozon/WB calls)."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from marketplaces.models import MarketplaceProductHistory, MarketplaceSettings
from marketplaces.views import (
    MarketplaceAlertsView,
    MarketplaceImportView,
    MarketplaceOpsSummaryView,
    MarketplaceOrderChatLinkView,
    MarketplaceSettingsView,
)


User = get_user_model()


class MarketplaceSandboxE2ETests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.provider = User.objects.create_user(
            username="mp_e2e",
            email="mp_e2e@example.com",
            password="test-pass-123",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.MARKETPLACES,
        )
        self.settings_obj = MarketplaceSettings.objects.create(
            provider=self.provider,
            environment="sandbox",
            notify_telegram=True,
            notify_push=True,
            notify_on_new_orders=True,
            notify_on_sync_errors=True,
        )

    def test_settings_exposes_notify_and_permissions(self):
        req = self.factory.get("/api/marketplaces/settings/")
        force_authenticate(req, user=self.provider)
        resp = MarketplaceSettingsView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("notify_telegram", resp.data)
        self.assertTrue(resp.data["permissions"]["marketplace_view_keys"])

    def test_sandbox_import_does_not_call_api(self):
        req = self.factory.post(
            "/api/marketplaces/products/import/",
            {
                "marketplace": "ozon",
                "products": [
                    {
                        "offer_id": "E2E-1",
                        "name": "Тест",
                        "category": "1",
                        "type": "2",
                        "images": ["https://cdn.example/a.jpg"],
                        "required_attributes": [],
                    }
                ],
            },
            format="json",
        )
        force_authenticate(req, user=self.provider)
        with patch("marketplaces.views.request_json") as mocked:
            resp = MarketplaceImportView.as_view()(req)
            mocked.assert_not_called()
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["results"][0]["sandbox"])
        hist = MarketplaceProductHistory.objects.get(offer_id="E2E-1")
        self.assertEqual(hist.status, "sandbox")

    def test_ops_summary_and_alerts(self):
        MarketplaceProductHistory.objects.create(
            provider=self.provider,
            marketplace="ozon",
            offer_id="FAIL-1",
            product_data={"name": "X", "stock": 0},
            status="failed",
            response={"import_errors": "attr missing"},
        )
        req = self.factory.get("/api/marketplaces/ops/summary/?hours=24")
        force_authenticate(req, user=self.provider)
        resp = MarketplaceOpsSummaryView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(resp.data["counts"]["failed_imports"], 1)

        req2 = self.factory.get("/api/marketplaces/alerts/")
        force_authenticate(req2, user=self.provider)
        resp2 = MarketplaceAlertsView.as_view()(req2)
        self.assertEqual(resp2.status_code, 200)
        self.assertIn("log_errors", resp2.data)

    def test_order_chat_link_creates_message(self):
        req = self.factory.post(
            "/api/marketplaces/orders/link-chat/",
            {"marketplace": "ozon", "order_id": "12345-0001", "text": "Тест заказ"},
            format="json",
        )
        force_authenticate(req, user=self.provider)
        resp = MarketplaceOrderChatLinkView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["ok"])
        self.assertTrue(resp.data["conversation_id"])

    @patch("notifications.push.notify_users")
    @patch("notifications.channels.send_telegram", return_value=True)
    def test_notify_marketplace_uses_flags(self, mocked_tg, mocked_push):
        from marketplaces.notify import notify_marketplace

        with patch("notifications.delivery.get_or_create_messaging") as gm:
            msg = type(
                "M",
                (),
                {
                    "enable_telegram": True,
                    "telegram_notify_chat_id": "1",
                    "resolved_telegram_bot_token": lambda self=None: "token",
                },
            )()
            gm.return_value = msg
            notify_marketplace(self.provider, title="T", body="B")
        mocked_tg.assert_called()
        mocked_push.assert_called()
