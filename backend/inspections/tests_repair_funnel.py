"""Repair funnel statuses after client approval."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from users.models import User

from inspections.models import InspectionItem, InspectionReport
from inspections.services import approve_report, set_repair_status


class RepairFunnelTests(TestCase):
    def setUp(self):
        self.provider = User.objects.create_user(
            username="sto-funnel",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SERVICE_CENTER,
            organization_name="СТО Север",
        )
        self.client_user = User.objects.create_user(
            username="client-funnel",
            password="x",
            role=User.Role.CLIENT,
        )
        self.report = InspectionReport.objects.create(
            provider=self.provider,
            client=self.client_user,
            vehicle_title="Camry",
            vehicle_plate="А111АА77",
            status=InspectionReport.Status.DRAFT,
        )
        InspectionItem.objects.create(
            report=self.report,
            title="Колодки",
            severity=InspectionItem.Severity.RECOMMENDED,
            parts_price=Decimal("1000"),
            labor_price=Decimal("2000"),
        )

    def test_approve_starts_in_progress(self):
        self.report.status = InspectionReport.Status.SENT
        self.report.save(update_fields=["status", "updated_at"])
        item_ids = list(self.report.items.values_list("id", flat=True))
        with patch("inspections.services.notify_inspection_approved"):
            with patch("inspections.services.notify_repair_status") as nr:
                approve_report(self.report, item_ids)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, InspectionReport.Status.APPROVED)
        self.assertEqual(self.report.repair_status, InspectionReport.RepairStatus.IN_PROGRESS)
        nr.assert_called_once()

    def test_set_repair_status_transitions(self):
        self.report.status = InspectionReport.Status.APPROVED
        self.report.repair_status = InspectionReport.RepairStatus.IN_PROGRESS
        self.report.save(update_fields=["status", "repair_status", "updated_at"])

        with patch("inspections.services.notify_repair_status") as mocked:
            for value in (
                InspectionReport.RepairStatus.WAITING_PARTS,
                InspectionReport.RepairStatus.READY,
                InspectionReport.RepairStatus.HANDED_OVER,
                InspectionReport.RepairStatus.IN_PROGRESS,
            ):
                mocked.reset_mock()
                set_repair_status(self.report, value)
                self.report.refresh_from_db()
                self.assertEqual(self.report.repair_status, value)
                mocked.assert_called_once()

    def test_set_repair_rejects_before_approve(self):
        with self.assertRaises(ValueError):
            set_repair_status(self.report, InspectionReport.RepairStatus.READY)

    def test_set_repair_rejects_none(self):
        self.report.status = InspectionReport.Status.APPROVED
        self.report.save(update_fields=["status", "updated_at"])
        with self.assertRaises(ValueError):
            set_repair_status(self.report, InspectionReport.RepairStatus.NONE)

    def test_notify_payload_includes_status(self):
        from inspections.services import notify_repair_status

        self.report.status = InspectionReport.Status.APPROVED
        self.report.repair_status = InspectionReport.RepairStatus.READY
        with patch("notifications.push.notify_users") as mocked:
            notify_repair_status(self.report)
        mocked.assert_called_once()
        self.assertEqual(mocked.call_args.kwargs["payload"]["repair_status"], "ready")
        self.assertEqual(mocked.call_args.kwargs["title"], "Авто готово")
