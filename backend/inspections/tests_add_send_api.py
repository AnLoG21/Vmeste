"""HTTP: inspection add item + send (service_center)."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from inspections.models import InspectionItem, InspectionReport
from users.models import User


class InspectionAddSendApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="sto-add-send-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SERVICE_CENTER,
            organization_name="СТО AddSend",
            organization_slug="sto-add-send-api",
        )
        self.client_user = User.objects.create_user(
            username="client-sto-add-send",
            password="x",
            role=User.Role.CLIENT,
        )
        self.report = InspectionReport.objects.create(
            provider=self.provider,
            client=self.client_user,
            vehicle_title="Hyundai Solaris",
            vehicle_plate="А123ВС77",
            status=InspectionReport.Status.DRAFT,
        )
        self.api.force_authenticate(self.provider)

    def test_add_item_to_draft(self):
        res = self.api.post(
            f"/api/inspections/reports/{self.report.id}/items/",
            {
                "title": "Тормозные колодки",
                "description": "Износ",
                "severity": "recommended",
                "parts_price": "1500.00",
                "labor_price": "2000.00",
                "sort_order": 0,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("title"), "Тормозные колодки")
        self.assertEqual(res.data.get("severity"), "recommended")
        self.assertTrue(res.data.get("selectable"))
        self.assertEqual(InspectionItem.objects.filter(report=self.report).count(), 1)

    def test_send_draft_with_item(self):
        InspectionItem.objects.create(
            report=self.report,
            title="Тормозные колодки",
            severity=InspectionItem.Severity.RECOMMENDED,
            parts_price=Decimal("1500.00"),
            labor_price=Decimal("2000.00"),
        )
        with patch("inspections.services.notify_inspection_sent"):
            res = self.api.post(
                f"/api/inspections/reports/{self.report.id}/send/",
                {},
                format="json",
            )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("status"), "sent")
        self.assertIsNotNone(res.data.get("sent_at"))
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, InspectionReport.Status.SENT)

    def test_send_empty_items_400(self):
        res = self.api.post(
            f"/api/inspections/reports/{self.report.id}/send/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("пункт", (res.data.get("detail") or "").lower())

    def test_add_item_non_draft_400(self):
        self.report.status = InspectionReport.Status.SENT
        self.report.save(update_fields=["status", "updated_at"])
        res = self.api.post(
            f"/api/inspections/reports/{self.report.id}/items/",
            {"title": "X", "severity": "recommended"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)

    def test_salon_forbidden(self):
        salon = User.objects.create_user(
            username="salon-no-add-send",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
        )
        self.api.force_authenticate(salon)
        res = self.api.post(
            f"/api/inspections/reports/{self.report.id}/items/",
            {"title": "X", "severity": "recommended"},
            format="json",
        )
        self.assertIn(res.status_code, (403, 404))
