"""HTTP: inspection repair-status funnel (after approved)."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from inspections.models import InspectionItem, InspectionReport
from users.models import User


class InspectionRepairStatusApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="sto-repair-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SERVICE_CENTER,
            organization_name="СТО Repair",
            organization_slug="sto-repair-api",
        )
        self.client_user = User.objects.create_user(
            username="client-sto-repair",
            password="x",
            role=User.Role.CLIENT,
        )
        self.report = InspectionReport.objects.create(
            provider=self.provider,
            client=self.client_user,
            vehicle_title="Hyundai Solaris",
            vehicle_plate="А123ВС77",
            status=InspectionReport.Status.APPROVED,
            repair_status=InspectionReport.RepairStatus.IN_PROGRESS,
        )
        InspectionItem.objects.create(
            report=self.report,
            title="Тормозные колодки",
            severity=InspectionItem.Severity.RECOMMENDED,
            parts_price=Decimal("1500.00"),
            labor_price=Decimal("2000.00"),
            client_selected=True,
        )
        self.api.force_authenticate(self.provider)

    def test_funnel_waiting_ready_handed(self):
        with patch("inspections.services.notify_repair_status"):
            waiting = self.api.post(
                f"/api/inspections/reports/{self.report.id}/repair-status/",
                {"repair_status": "waiting_parts"},
                format="json",
            )
            self.assertEqual(waiting.status_code, 200, waiting.data)
            self.assertEqual(waiting.data.get("repair_status"), "waiting_parts")

            ready = self.api.post(
                f"/api/inspections/reports/{self.report.id}/repair-status/",
                {"repair_status": "ready"},
                format="json",
            )
            self.assertEqual(ready.status_code, 200, ready.data)
            self.assertEqual(ready.data.get("repair_status"), "ready")

            handed = self.api.post(
                f"/api/inspections/reports/{self.report.id}/repair-status/",
                {"repair_status": "handed_over"},
                format="json",
            )
            self.assertEqual(handed.status_code, 200, handed.data)
            self.assertEqual(handed.data.get("repair_status"), "handed_over")

        self.report.refresh_from_db()
        self.assertEqual(self.report.repair_status, InspectionReport.RepairStatus.HANDED_OVER)
        self.assertIsNotNone(self.report.repair_status_updated_at)

    def test_draft_forbidden(self):
        self.report.status = InspectionReport.Status.DRAFT
        self.report.repair_status = InspectionReport.RepairStatus.NONE
        self.report.save(update_fields=["status", "repair_status", "updated_at"])
        res = self.api.post(
            f"/api/inspections/reports/{self.report.id}/repair-status/",
            {"repair_status": "waiting_parts"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)

    def test_none_rejected(self):
        res = self.api.post(
            f"/api/inspections/reports/{self.report.id}/repair-status/",
            {"repair_status": "none"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
