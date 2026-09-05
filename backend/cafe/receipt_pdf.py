"""Генерация PDF-чека для заказа кафе."""

from __future__ import annotations

from decimal import Decimal

from fpdf import FPDF

from pdf_fonts import find_cyrillic_font

PAY_METHOD_LABELS = {
    "online": "Онлайн",
    "cash": "Наличные",
    "card_on_spot": "Картой на месте",
}


def _rub(value) -> str:
    return f"{Decimal(value):.2f} руб."


def build_cafe_order_receipt_pdf(
    *,
    organization_name: str,
    order_id: int,
    lines: list[dict],
    items_total: Decimal,
    delivery_fee: Decimal,
    tip_amount: Decimal,
    tip_percent: int,
    tip_custom: bool,
    service_charge_amount: Decimal,
    include_service_charge: bool,
    total: Decimal,
    pay_method: str,
    paid_at: str = "",
) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    font_path, bold_path = find_cyrillic_font()
    pdf.add_font("Main", "", font_path)
    if bold_path:
        pdf.add_font("Main", "B", bold_path)
    family = "Main"

    def write_line(text: str, size: int = 11, bold: bool = False):
        style = "B" if bold and bold_path else ""
        pdf.set_font(family, style=style, size=size)
        pdf.multi_cell(0, size * 0.5, text)
        pdf.ln(1)

    write_line(organization_name or "Кафе", size=16, bold=True)
    write_line(f"Чек по заказу #{order_id}", size=12)
    if paid_at:
        write_line(f"Оплачен: {paid_at}", size=10)

    pdf.ln(3)
    write_line("Позиции:", bold=True)
    for row in lines:
        removed = row.get("removed") or []
        suffix = f" (без: {', '.join(removed)})" if removed else ""
        write_line(
            f"- {row['name']}{suffix} — {row['quantity']} × {_rub(row['unit_price'])} = {_rub(row['line_total'])}",
            size=10,
        )

    pdf.ln(4)
    write_line(f"Блюда: {_rub(items_total)}", size=10)
    if delivery_fee > 0:
        write_line(f"Доставка: {_rub(delivery_fee)}", size=10)
    if tip_amount > 0:
        if tip_custom:
            write_line(f"Чаевые: {_rub(tip_amount)}", size=10)
        elif tip_percent:
            write_line(f"Чаевые ({tip_percent}%): {_rub(tip_amount)}", size=10)
        else:
            write_line(f"Чаевые: {_rub(tip_amount)}", size=10)
    if include_service_charge and service_charge_amount > 0:
        write_line(f"Сервисный сбор (3%): {_rub(service_charge_amount)}", size=10)
    write_line(f"Итого: {_rub(total)}", size=13, bold=True)
    write_line(f"Способ оплаты: {PAY_METHOD_LABELS.get(pay_method, pay_method)}", size=10)

    out = pdf.output()
    if isinstance(out, str):
        return out.encode("latin-1")
    return bytes(out)
