"""Product labels + Ozon/WB/Yandex label action wiring."""

from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from marketplaces.clients import OZON_ACTIONS, WB_ACTIONS, YANDEX_ACTIONS, build_product_label_pdf
from marketplaces.models import MarketplaceProductHistory, MarketplaceSettings
from users.models import User


class MarketplaceLabelHelpersTests(TestCase):
    def test_ozon_label_actions_are_async(self):
        self.assertIn("orders.label.create", OZON_ACTIONS)
        self.assertIn("orders.label.get", OZON_ACTIONS)
        self.assertNotIn("orders.label", OZON_ACTIONS)
        self.assertTrue(OZON_ACTIONS["orders.label.create"][1].endswith("/v3/posting/fbs/package-label/create"))
        self.assertTrue(OZON_ACTIONS["orders.label.get"][1].endswith("/v2/posting/fbs/package-label/get"))

    def test_ozon_orders_and_finance_paths(self):
        self.assertIn("/v4/posting/fbs/list", OZON_ACTIONS["orders.list"][1])
        self.assertIn("/v4/posting/fbs/ship", OZON_ACTIONS["orders.ship"][1])
        self.assertIn("/v1/finance/accrual/by-day", OZON_ACTIONS["finance.list"][1])
        from marketplaces.health import structural_audit

        fails = [c for c in structural_audit() if not c.get("ok")]
        self.assertEqual(fails, [])

    def test_wb_and_yandex_label_actions(self):
        self.assertIn("orders.stickers", WB_ACTIONS)
        self.assertIn("orders.label", YANDEX_ACTIONS)
        self.assertIn("/delivery/labels", YANDEX_ACTIONS["orders.label"][1])

    def test_build_product_label_pdf(self):
        pdf = build_product_label_pdf(
            offer_id="SKU-42",
            name="Товар тест",
            barcode="2001234567890",
            price="990",
            copies=2,
        )
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 500)


class MarketplaceProductLabelApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="mp-label-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.MARKETPLACES,
            organization_name="МП Labels",
            organization_slug="mp-label-api",
        )
        self.api.force_authenticate(self.provider)
        MarketplaceSettings.objects.create(provider=self.provider, environment="prod")
        self.row = MarketplaceProductHistory.objects.create(
            provider=self.provider,
            marketplace="ozon",
            offer_id="OFF-1",
            product_data={"name": "Кружка", "barcode": "2001112223334", "price": "350"},
            status="success",
        )

    def test_product_label_by_history_id(self):
        res = self.api.post(
            "/api/marketplaces/products/label/",
            {"history_id": self.row.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content[:200]))
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertTrue(res.content.startswith(b"%PDF"))

    @patch("marketplaces.views.fetch_ozon_package_label_pdf", return_value=b"%PDF-1.4 mock")
    def test_order_label_ozon_uses_async_helper(self, mock_fetch):
        res = self.api.post(
            "/api/marketplaces/orders/label/",
            {"marketplace": "ozon", "posting_numbers": ["12345-0001-1"]},
            format="json",
        )
        self.assertEqual(res.status_code, 200, getattr(res, "data", res.content[:200]))
        self.assertTrue(res.content.startswith(b"%PDF"))
        mock_fetch.assert_called_once()
        kwargs = mock_fetch.call_args.kwargs
        self.assertEqual(kwargs["posting_numbers"], ["12345-0001-1"])
