"""Tests for marketplaces module (Django TestCase, no live API calls)."""

from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from marketplaces.clients import (
    build_ozon_item,
    generate_local_ean13,
    humanize_api_error,
    normalize_marketplace_images,
    normalize_product_identifiers,
    validate_product_for_import,
)
from marketplaces.models import MarketplaceApiLog, MarketplaceProductHistory, MarketplaceSettings
from marketplaces.views import (
    MarketplaceBarcodeView,
    MarketplaceExportView,
    MarketplaceLogsView,
    MarketplaceSettingsView,
    MarketplaceWebhookView,
    _history_item,
)


User = get_user_model()


class MarketplaceClientHelpersTests(SimpleTestCase):
    def test_normalize_images_skips_video(self):
        urls = normalize_marketplace_images(
            {
                "images": [
                    {"url": "https://cdn.example/a.jpg", "public_url": "https://cdn.example/a.jpg"},
                    {"url": "https://cdn.example/v.webm", "kind": "video", "public_url": "https://cdn.example/v.webm"},
                ]
            }
        )
        self.assertEqual(urls, ["https://cdn.example/a.jpg"])

    def test_validate_requires_offer_and_name(self):
        errs = validate_product_for_import({"offer_id": "", "name": ""}, "ozon")
        self.assertTrue(any("артикул" in e.lower() for e in errs))
        self.assertTrue(any("название" in e.lower() for e in errs))

    def test_build_ozon_item_basic(self):
        item = build_ozon_item(
            {
                "offer_id": "SKU-1",
                "name": "Товар",
                "price": "100",
                "category": "1",
                "type": "2",
                "images": ["https://cdn.example/a.jpg"],
            }
        )
        self.assertEqual(item["offer_id"], "SKU-1")
        self.assertEqual(item["description_category_id"], 1)
        self.assertEqual(item["type_id"], 2)

    def test_normalize_identifiers_wb(self):
        data = normalize_product_identifiers({"offer_id": "A1", "nmID": "123"}, "wildberries")
        self.assertEqual(data["vendor_code"], "A1")
        self.assertEqual(data["nm_id"], 123)

    def test_humanize_rate_limit(self):
        msg = humanize_api_error("rate limit exceeded for `seller-api` client, current max rate per sec.: 2", 429)
        self.assertIn("2/сек", msg)

    def test_humanize_reviews_subscription(self):
        msg = humanize_api_error(
            "ReviewList error: rpc error: code = PermissionDenied desc = not available with existing subscription",
            403,
        )
        self.assertIn("тариф", msg.lower())

    def test_validate_requires_photo(self):
        errs = validate_product_for_import(
            {"offer_id": "A", "name": "N", "category": "1", "type": "2", "images": []},
            "ozon",
        )
        self.assertTrue(any("фото" in e.lower() for e in errs))


class MarketplaceApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.provider = User.objects.create_user(
            username="mp_provider",
            email="mp@example.com",
            password="test-pass-123",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.MARKETPLACES,
        )
        self.settings_obj = MarketplaceSettings.objects.create(
            provider=self.provider,
            environment="sandbox",
            webhook_secret="test-secret-xyz",
        )

    def test_logs_endpoint(self):
        MarketplaceApiLog.objects.create(
            provider=self.provider,
            marketplace="ozon",
            endpoint="https://api-seller.ozon.ru/v3/product/list",
            method="POST",
            status_code=200,
        )
        req = self.factory.get("/api/marketplaces/logs/")
        force_authenticate(req, user=self.provider)
        resp = MarketplaceLogsView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_export_csv(self):
        MarketplaceProductHistory.objects.create(
            provider=self.provider,
            marketplace="ozon",
            offer_id="SKU-1",
            product_data={"name": "Товар", "price": "10"},
            status="success",
        )
        req = self.factory.get("/api/marketplaces/export/?export=csv")
        force_authenticate(req, user=self.provider)
        resp = MarketplaceExportView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp["Content-Type"])
        self.assertIn("SKU-1", resp.content.decode("utf-8"))

    def test_history_item_identifiers(self):
        row = MarketplaceProductHistory.objects.create(
            provider=self.provider,
            marketplace="wildberries",
            offer_id="V1",
            product_data={"vendor_code": "V1", "nm_id": 55, "name": "N"},
            status="success",
        )
        item = _history_item(row)
        self.assertEqual(item["nm_id"], 55)
        self.assertEqual(item["vendor_code"], "V1")

    @patch("marketplaces.tasks.sync_provider_task.delay")
    def test_webhook_triggers_sync(self, mock_delay):
        mock_delay.return_value = MagicMock(id="task-test-1")
        req = self.factory.post(
            "/api/marketplaces/webhook/",
            {"secret": "test-secret-xyz"},
            format="json",
        )
        resp = MarketplaceWebhookView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data.get("ok"))
        mock_delay.assert_called_once_with(self.provider.id)

    def test_webhook_rejects_bad_secret(self):
        req = self.factory.post("/api/marketplaces/webhook/", {"secret": "nope"}, format="json")
        resp = MarketplaceWebhookView.as_view()(req)
        self.assertEqual(resp.status_code, 403)

    def test_settings_rotate_webhook(self):
        req = self.factory.patch(
            "/api/marketplaces/settings/",
            {"rotate_webhook_secret": True},
            format="json",
        )
        force_authenticate(req, user=self.provider)
        resp = MarketplaceSettingsView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data.get("webhook_secret"))
        self.settings_obj.refresh_from_db()
        self.assertTrue(self.settings_obj.webhook_secret)
        self.assertNotEqual(self.settings_obj.webhook_secret, "test-secret-xyz")

    def test_barcode_local_without_product_ids(self):
        req = self.factory.post(
            "/api/marketplaces/barcodes/generate/",
            {"marketplace": "ozon", "local": True, "count": 1},
            format="json",
        )
        force_authenticate(req, user=self.provider)
        resp = MarketplaceBarcodeView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.get("source"), "local")
        self.assertEqual(len(resp.data.get("barcodes") or []), 1)
        code = resp.data["barcodes"][0]
        self.assertEqual(len(code), 13)
        self.assertTrue(code.startswith("200"))


class LocalEanTests(SimpleTestCase):
    def test_ean13_checksum_length(self):
        codes = generate_local_ean13(3)
        self.assertEqual(len(codes), 3)
        for code in codes:
            self.assertEqual(len(code), 13)
            digits = [int(c) for c in code]
            check = (10 - (sum(digits[i] * (3 if i % 2 else 1) for i in range(12)) % 10)) % 10
            self.assertEqual(digits[12], check)
