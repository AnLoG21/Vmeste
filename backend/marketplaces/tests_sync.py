"""Mocked Ozon import-status sync."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from marketplaces.models import MarketplaceProductHistory, MarketplaceSettings
from marketplaces.sync import sync_pending_ozon_imports


User = get_user_model()


class OzonImportSyncTests(TestCase):
    def setUp(self):
        self.provider = User.objects.create_user(
            username="mp_sync",
            email="mp_sync@example.com",
            password="test-pass-123",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.MARKETPLACES,
        )
        self.settings_obj = MarketplaceSettings.objects.create(
            provider=self.provider,
            environment="prod",
            ozon_client_id="cid",
            ozon_api_key="key",
        )

    def _pending(self, offer_id: str, task_id: int = 42):
        return MarketplaceProductHistory.objects.create(
            provider=self.provider,
            marketplace="ozon",
            offer_id=offer_id,
            product_data={"name": offer_id},
            status="pending",
            response={"task_id": task_id},
        )

    @patch("marketplaces.clients.request_json")
    def test_sync_marks_success(self, mocked):
        hist = self._pending("OK-1")
        mocked.return_value = {
            "result": {
                "items": [{"offer_id": "OK-1", "product_id": 99, "status": "imported", "errors": []}],
            }
        }
        result = sync_pending_ozon_imports(limit=10)
        self.assertEqual(result["ok"], 1)
        hist.refresh_from_db()
        self.assertEqual(hist.status, "success")
        self.assertEqual(hist.response["import_status"], "success")
        mocked.assert_called_once()

    @patch("marketplaces.clients.request_json")
    def test_sync_marks_failed(self, mocked):
        hist = self._pending("FAIL-1", task_id=7)
        mocked.return_value = {
            "result": {
                "items": [
                    {
                        "offer_id": "FAIL-1",
                        "status": "failed",
                        "errors": [{"message": "bad attr"}],
                    }
                ],
            }
        }
        result = sync_pending_ozon_imports(limit=10)
        self.assertEqual(result["failed"], 1)
        hist.refresh_from_db()
        self.assertEqual(hist.status, "failed")
        self.assertIn("bad attr", hist.response.get("import_errors") or "")

    def test_sync_skips_sandbox_and_missing_task(self):
        self.settings_obj.environment = "sandbox"
        self.settings_obj.save(update_fields=["environment", "updated_at"])
        self._pending("SBX-1")
        MarketplaceProductHistory.objects.create(
            provider=self.provider,
            marketplace="ozon",
            offer_id="NO-TASK",
            product_data={},
            status="pending",
            response={},
        )
        with patch("marketplaces.clients.request_json") as mocked:
            result = sync_pending_ozon_imports(limit=10)
            mocked.assert_not_called()
        self.assertEqual(result["ok"], 0)
        self.assertEqual(result["failed"], 0)
        self.assertGreaterEqual(result["skipped"], 2)
