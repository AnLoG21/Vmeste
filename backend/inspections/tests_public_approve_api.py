"""HTTP: public inspection approve by share token."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from inspections.models import InspectionItem, InspectionReport


class InspectionPublicApproveApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="sto-public-approve",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SERVICE_CENTER,
            organization_name="СТО Approve",
        )
        self.client_user = User.objects.create_user(
            username="client-public-approve",
            password="x",
            role=User.Role.CLIENT,
        )
        self.report = InspectionReport.objects.create(
            provider=self.provider,
            client=self.client_user,
            vehicle_title="Solaris",
            vehicle_plate="А123ВС77",
            status=InspectionReport.Status.SENT,
        )
        self.item = InspectionItem.objects.create(
            report=self.report,
            title="Колодки",
            severity=InspectionItem.Severity.RECOMMENDED,
            parts_price=Decimal("1000"),
            labor_price=Decimal("2000"),
        )

    def test_get_sent_report(self):
        res = self.api.get(f"/api/inspections/public/{self.report.share_token}/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("status"), InspectionReport.Status.SENT)
        self.assertGreaterEqual(len(res.data.get("items") or []), 1)

    def test_approve_selected_items(self):
        with patch("inspections.services.notify_inspection_approved"):
            with patch("inspections.services.notify_repair_status"):
                res = self.api.post(
                    f"/api/inspections/public/{self.report.share_token}/approve/",
                    {"selected_item_ids": [self.item.id]},
                    format="json",
                )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("status"), InspectionReport.Status.APPROVED)
        self.assertEqual(res.data.get("repair_status"), InspectionReport.RepairStatus.IN_PROGRESS)
        self.item.refresh_from_db()
        self.assertTrue(self.item.client_selected)

    def test_approve_rejects_draft(self):
        self.report.status = InspectionReport.Status.DRAFT
        self.report.save(update_fields=["status", "updated_at"])
        res = self.api.post(
            f"/api/inspections/public/{self.report.share_token}/approve/",
            {"selected_item_ids": [self.item.id]},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("недоступен", (res.data.get("detail") or "").lower())

    def test_approve_rejects_invalid_ids(self):
        res = self.api.post(
            f"/api/inspections/public/{self.report.share_token}/approve/",
            {"selected_item_ids": ["x"]},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
