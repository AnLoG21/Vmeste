"""PDF: акт согласования и заказ-наряд."""

from __future__ import annotations

import os
import platform
from decimal import Decimal

from django.utils import timezone
from fpdf import FPDF

from booking.booking_actions import client_display_name

from .models import InspectionItem, InspectionReport


def _rub(value) -> str:
    return f"{Decimal(value):.2f} ₽"


def _find_cyrillic_font() -> str | None:
    candidates = []
    if platform.system() == "Windows":
        candidates.extend(
            [
                r"C:\Windows\Fonts\arial.ttf",
                r"C:\Windows\Fonts\segoeui.ttf",
            ]
        )
    candidates.extend(
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        ]
    )
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def _org_name(report: InspectionReport) -> str:
    prov = report.provider
    return (getattr(prov, "organization_name", None) or "").strip() or (prov.username if prov else "Организация")


def _vehicle_line(report: InspectionReport) -> str:
    parts = [p for p in (report.vehicle_title, report.vehicle_plate, report.vehicle_vin) if (p or "").strip()]
    return " · ".join(parts) if parts else "—"


SEVERITY_LABELS = {
    "critical": "Критично",
    "recommended": "Рекомендуется",
    "ok": "В порядке",
}


def _build_pdf(report: InspectionReport, *, doc_title: str, selected_only: bool) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    font_path = _find_cyrillic_font()
    bold_path = None
    if font_path:
        pdf.add_font("Main", "", font_path)
        if platform.system() == "Windows":
            for p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\segoeuib.ttf"):
                if os.path.isfile(p):
                    bold_path = p
                    break
        if bold_path:
            pdf.add_font("Main", "B", bold_path)
        family = "Main"
    else:
        family = "Helvetica"

    def write_line(text: str, size: int = 11, bold: bool = False):
        style = "B" if bold and (family == "Helvetica" or bold_path) else ""
        pdf.set_font(family, style=style, size=size)
        pdf.multi_cell(0, size * 0.5, text)
        pdf.ln(1)

    write_line(_org_name(report), size=16, bold=True)
    write_line(doc_title, size=13, bold=True)
    write_line(f"Отчёт №{report.id}", size=11)
    write_line(f"Клиент: {client_display_name(report.client) or report.client.username}", size=10)
    write_line(f"Авто: {_vehicle_line(report)}", size=10)
    if report.approved_at:
        when = timezone.localtime(report.approved_at).strftime("%d.%m.%Y %H:%M")
        write_line(f"Утверждено клиентом: {when}", size=10)
    elif report.sent_at:
        when = timezone.localtime(report.sent_at).strftime("%d.%m.%Y %H:%M")
        write_line(f"Отправлено: {when}", size=10)

    pdf.ln(3)
    write_line("Позиции:", bold=True)

    items = list(report.items.all())
    if selected_only:
        items = [i for i in items if i.client_selected and i.severity != InspectionItem.Severity.OK]
    else:
        items = [i for i in items if i.severity != InspectionItem.Severity.OK or True]

    for item in items:
        if selected_only and not item.client_selected:
            continue
        sev = SEVERITY_LABELS.get(item.severity, item.severity)
        mark = "✓" if item.client_selected else ("—" if item.severity == InspectionItem.Severity.OK else "○")
        write_line(
            f"{mark} [{sev}] {item.title} — запчасти {_rub(item.parts_price)}, работа {_rub(item.labor_price)}",
            size=10,
        )
        if (item.description or "").strip():
            write_line(f"   {item.description.strip()}", size=9)

    pdf.ln(4)
    write_line(f"Запчасти: {_rub(report.parts_total)}", size=10)
    write_line(f"Работы: {_rub(report.labor_total)}", size=10)
    write_line(f"Итого: {_rub(report.grand_total)}", size=13, bold=True)
    write_line(
        "Электронная отметка клиента на платформе Вместе. Споры по неутверждённым позициям не принимаются.",
        size=8,
    )

    out = pdf.output()
    if isinstance(out, str):
        return out.encode("latin-1")
    return bytes(out)


def build_agreement_pdf(report: InspectionReport) -> bytes:
    return _build_pdf(
        report,
        doc_title="Акт согласования работ",
        selected_only=True,
    )


def build_work_order_pdf(report: InspectionReport) -> bytes:
    return _build_pdf(
        report,
        doc_title="Заказ-наряд",
        selected_only=True,
    )
