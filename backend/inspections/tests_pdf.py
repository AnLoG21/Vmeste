"""Inspection PDF generation — Cyrillic fonts and smoke output (no DB required)."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from django.utils import timezone

from cafe.receipt_pdf import build_cafe_order_receipt_pdf
from inspections.documents import build_agreement_pdf, build_work_order_pdf
from pdf_fonts import PdfFontError, find_cyrillic_font, packaged_fonts_dir


def _fake_report(**overrides):
    provider = SimpleNamespace(
        organization_name="Автосервис Север",
        username="sto",
    )
    client = SimpleNamespace(
        username="client",
        first_name="Алексей",
        last_name="Сидоров",
        patronymic="",
    )
    item = SimpleNamespace(
        title="Замена колодок",
        description="Передние тормозные колодки",
        severity="recommended",
        parts_price=Decimal("1500.00"),
        labor_price=Decimal("3500.00"),
        client_selected=True,
    )
    items = SimpleNamespace(all=lambda: [item])
    base = dict(
        id=7,
        provider=provider,
        client=client,
        vehicle_title="Toyota Camry",
        vehicle_plate="А123ВС77",
        vehicle_vin="",
        approved_at=timezone.now(),
        sent_at=None,
        parts_total=Decimal("1500.00"),
        labor_total=Decimal("3500.00"),
        grand_total=Decimal("5000.00"),
        items=items,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class PdfFontDiscoveryTests(SimpleTestCase):
    def test_packaged_dejavu_present(self):
        import os

        pkg = packaged_fonts_dir()
        self.assertTrue(os.path.isfile(os.path.join(pkg, "DejaVuSans.ttf")))
        self.assertTrue(os.path.isfile(os.path.join(pkg, "DejaVuSans-Bold.ttf")))

    def test_find_cyrillic_font_returns_paths(self):
        regular, bold = find_cyrillic_font()
        self.assertTrue(regular)
        self.assertTrue(regular.lower().endswith(".ttf"))
        self.assertTrue(bold)

    def test_missing_font_raises(self):
        with patch("pdf_fonts.os.path.isfile", return_value=False):
            with self.assertRaises(PdfFontError):
                find_cyrillic_font()


class InspectionPdfTests(SimpleTestCase):
    def test_agreement_pdf_cyrillic_smoke(self):
        raw = build_agreement_pdf(_fake_report())
        self.assertTrue(raw.startswith(b"%PDF"))
        self.assertGreater(len(raw), 800)
        self.assertNotIn(b"Otchet N", raw)

    def test_work_order_pdf_cyrillic_smoke(self):
        raw = build_work_order_pdf(_fake_report())
        self.assertTrue(raw.startswith(b"%PDF"))
        self.assertGreater(len(raw), 800)


class CafeReceiptPdfTests(SimpleTestCase):
    def test_receipt_cyrillic_smoke(self):
        raw = build_cafe_order_receipt_pdf(
            organization_name="Кафе Уют",
            order_id=42,
            lines=[
                {
                    "name": "Борщ",
                    "quantity": 2,
                    "unit_price": Decimal("250.00"),
                    "line_total": Decimal("500.00"),
                    "removed": [],
                }
            ],
            items_total=Decimal("500.00"),
            delivery_fee=Decimal("0"),
            tip_amount=Decimal("50.00"),
            tip_percent=10,
            tip_custom=False,
            service_charge_amount=Decimal("0"),
            include_service_charge=False,
            total=Decimal("550.00"),
            pay_method="cash",
        )
        self.assertTrue(raw.startswith(b"%PDF"))
        self.assertGreater(len(raw), 500)
