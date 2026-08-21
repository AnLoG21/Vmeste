"""Business logic: send, approve, notify."""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import InspectionItem, InspectionReport


def recalculate_totals(report: InspectionReport, *, selected_only: bool = False) -> None:
    parts = Decimal("0.00")
    labor = Decimal("0.00")
    qs = report.items.all()
    if selected_only:
        qs = qs.filter(client_selected=True)
    for item in qs:
        if item.severity == InspectionItem.Severity.OK:
            continue
        if selected_only and not item.client_selected:
            continue
        parts += Decimal(item.parts_price or 0)
        labor += Decimal(item.labor_price or 0)
    report.parts_total = parts.quantize(Decimal("0.01"))
    report.labor_total = labor.quantize(Decimal("0.01"))
    report.grand_total = (parts + labor).quantize(Decimal("0.01"))


def public_url_for(report: InspectionReport) -> str:
    front = (getattr(settings, "FRONTEND_URL", "") or "https://vsevmeste.space").rstrip("/")
    return f"{front}/i/{report.share_token}/"


def notify_inspection_sent(report: InspectionReport) -> None:
    from notifications.models import InAppNotification
    from notifications.push import notify_users
    from chat.services import post_inspection_message

    org = (getattr(report.provider, "organization_name", None) or report.provider.username or "Сервис").strip()
    vehicle = (report.vehicle_title or report.vehicle_plate or "авто").strip()
    title = "Диагностика завершена"
    body = f"{org}: согласуйте перечень работ по {vehicle}"
    notify_users(
        [report.client_id],
        kind=InAppNotification.Kind.INSPECTION,
        title=title,
        body=body,
        payload={
            "inspection_id": str(report.id),
            "share_token": str(report.share_token),
            "view": "inspections",
        },
    )
    try:
        post_inspection_message(
            report.provider,
            report.client,
            report,
            sender=report.created_by or report.provider,
        )
    except Exception:
        pass


def notify_inspection_approved(report: InspectionReport) -> None:
    from notifications.models import InAppNotification
    from notifications.push import notify_users
    from booking.booking_actions import client_display_name

    client_name = client_display_name(report.client) or "Клиент"
    recipients = {report.provider_id}
    if report.created_by_id:
        recipients.add(report.created_by_id)
    notify_users(
        list(recipients),
        kind=InAppNotification.Kind.INSPECTION,
        title="Клиент утвердил ремонт",
        body=f"{client_name}: итого {report.grand_total} ₽",
        payload={
            "inspection_id": str(report.id),
            "share_token": str(report.share_token),
            "view": "inspections",
            "grand_total": str(report.grand_total),
        },
    )


def notify_repair_status(report: InspectionReport) -> None:
    from notifications.models import InAppNotification
    from notifications.push import notify_users

    if report.repair_status == InspectionReport.RepairStatus.IN_PROGRESS:
        title = "Ремонт в работе"
        body = "Автосервис приступил к согласованным работам."
    elif report.repair_status == InspectionReport.RepairStatus.READY:
        title = "Авто готово"
        body = "Ремонт завершён — можно забирать автомобиль."
    else:
        return
    org = (getattr(report.provider, "organization_name", None) or report.provider.username or "Автосервис").strip()
    vehicle = (report.vehicle_title or report.vehicle_plate or "").strip()
    if vehicle:
        body = f"{org} · {vehicle}: {body}"
    else:
        body = f"{org}: {body}"
    notify_users(
        [report.client_id],
        kind=InAppNotification.Kind.INSPECTION,
        title=title,
        body=body[:240],
        payload={
            "inspection_id": str(report.id),
            "share_token": str(report.share_token),
            "view": "inspections",
            "repair_status": report.repair_status,
        },
    )


@transaction.atomic
def send_report(report: InspectionReport) -> InspectionReport:
    if report.status != InspectionReport.Status.DRAFT:
        raise ValueError("Отправить можно только черновик.")
    if not report.items.exists():
        raise ValueError("Добавьте хотя бы один пункт диагностики.")
    report.status = InspectionReport.Status.SENT
    report.sent_at = timezone.now()
    report.save(update_fields=["status", "sent_at", "updated_at"])
    notify_inspection_sent(report)
    return report


@transaction.atomic
def approve_report(report: InspectionReport, selected_item_ids: list[int]) -> InspectionReport:
    if report.status != InspectionReport.Status.SENT:
        raise ValueError("Утвердить можно только отправленный отчёт.")
    selected = {int(x) for x in (selected_item_ids or [])}
    for item in report.items.select_for_update():
        if not item.is_selectable():
            item.client_selected = False
        else:
            item.client_selected = item.id in selected
        item.save(update_fields=["client_selected"])
    recalculate_totals(report, selected_only=True)
    report.status = InspectionReport.Status.APPROVED
    report.approved_at = timezone.now()
    # After approval, repair starts as «в работе» by default unless already set.
    if report.repair_status == InspectionReport.RepairStatus.NONE:
        report.repair_status = InspectionReport.RepairStatus.IN_PROGRESS
        report.repair_status_updated_at = timezone.now()
    report.save(
        update_fields=[
            "status",
            "approved_at",
            "repair_status",
            "repair_status_updated_at",
            "parts_total",
            "labor_total",
            "grand_total",
            "updated_at",
        ]
    )
    notify_inspection_approved(report)
    notify_repair_status(report)
    return report


@transaction.atomic
def set_repair_status(report: InspectionReport, repair_status: str) -> InspectionReport:
    if report.status != InspectionReport.Status.APPROVED:
        raise ValueError("Статус ремонта можно менять только после утверждения клиентом.")
    allowed = {c[0] for c in InspectionReport.RepairStatus.choices}
    if repair_status not in allowed or repair_status == InspectionReport.RepairStatus.NONE:
        raise ValueError("Укажите статус: в работе или готов.")
    if report.repair_status == repair_status:
        return report
    report.repair_status = repair_status
    report.repair_status_updated_at = timezone.now()
    report.save(update_fields=["repair_status", "repair_status_updated_at", "updated_at"])
    notify_repair_status(report)
    return report
