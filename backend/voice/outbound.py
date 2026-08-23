"""Outbound confirmation calls (phase 2 — queue + Mango dial)."""

from __future__ import annotations

import logging
import re
from datetime import timedelta

from django.utils import timezone

from booking.models import Booking

from .mango import mango_callback
from .models import ProviderVoiceSettings, VoiceCallSession, VoiceOutboundLog

logger = logging.getLogger(__name__)


def _digits(phone: str) -> str:
    return re.sub(r"\D+", "", phone or "")


def pending_confirmation_bookings(provider_id: int, *, hours_ahead: int = 36) -> list[dict]:
    """Bookings in the next window that are not cancelled."""
    now = timezone.now()
    window_end = now + timedelta(hours=hours_ahead)
    already = set(
        VoiceOutboundLog.objects.filter(
            provider_id=provider_id,
            status__in=[VoiceOutboundLog.Status.DIALING, VoiceOutboundLog.Status.DONE],
            created_at__gte=now - timedelta(hours=20),
        ).values_list("booking_id", flat=True)
    )
    qs = (
        Booking.objects.filter(
            provider_id=provider_id,
            status__in=[Booking.Status.NEW, Booking.Status.CONFIRMED],
            slot__starts_at__gte=now,
            slot__starts_at__lte=window_end,
        )
        .exclude(id__in=already)
        .select_related("slot", "service", "client", "provider")
        .order_by("slot__starts_at")[:50]
    )
    rows = []
    for b in qs:
        slot = b.slot
        starts = slot.starts_at if slot else None
        phone = getattr(b.client, "phone", "") or ""
        if len(_digits(phone)) < 10:
            continue
        rows.append(
            {
                "id": b.id,
                "status": b.status,
                "client_phone": phone,
                "service_name": getattr(b.service, "name", "") or "",
                "starts_at": starts.isoformat() if starts else "",
                "starts_at_label": starts.strftime("%d.%m.%Y %H:%M") if starts else "",
            }
        )
    return rows


def _confirm_script(booking: Booking) -> str:
    starts = booking.slot.starts_at if booking.slot else None
    when = starts.strftime("%d.%m в %H:%M") if starts else "скоро"
    svc = getattr(booking.service, "name", "") or "услугу"
    org = getattr(booking.provider, "organization_name", "") or "салон"
    return (
        f"Здравствуйте! Это {org}. Напоминаем о записи на {svc} {when}. "
        f"Подтверждаете визит? Скажите «да» или «нет»."
    )


def dial_booking_confirmation(vs: ProviderVoiceSettings, booking_id: int) -> dict:
    booking = (
        Booking.objects.filter(pk=booking_id, provider_id=vs.provider_id)
        .select_related("slot", "service", "client", "provider")
        .first()
    )
    if not booking:
        return {"ok": False, "error": "Запись не найдена."}
    phone = getattr(booking.client, "phone", "") or ""
    if len(_digits(phone)) < 10:
        return {"ok": False, "error": "У клиента нет телефона."}
    if not vs.has_mango():
        return {"ok": False, "error": "Укажите ключ и salt Mango Office в настройках голоса."}
    line = (vs.mango_line_number or vs.inbound_phone or "").strip()
    if not _digits(line):
        return {"ok": False, "error": "Укажите исходящую линию Mango (номер салона)."}

    script = _confirm_script(booking)
    session = VoiceCallSession.objects.create(
        provider=vs.provider,
        caller_phone=phone,
        context={
            "mode": "confirm",
            "booking_id": booking.id,
            "confirm_script": script,
        },
    )

    log = VoiceOutboundLog.objects.create(
        provider=vs.provider,
        booking=booking,
        phone=phone,
        status=VoiceOutboundLog.Status.QUEUED,
        session=session,
    )

    res = mango_callback(
        api_key=vs.mango_api_key,
        api_salt=vs.mango_api_salt,
        to_number=phone,
        line_number=line,
        from_extension=vs.mango_extension or "",
        command_id=f"vmeste-b{booking.id}-{log.id}",
    )
    if res.get("ok"):
        log.status = VoiceOutboundLog.Status.DIALING
        log.external_command_id = res.get("command_id") or ""
        log.save(update_fields=["status", "external_command_id"])
        session.external_call_id = log.external_command_id
        session.save(update_fields=["external_call_id"])
        return {"ok": True, "booking_id": booking.id, "session_id": session.id, "log_id": log.id}
    log.status = VoiceOutboundLog.Status.FAILED
    log.error = str(res.get("error") or res.get("raw") or "Mango error")[:500]
    log.save(update_fields=["status", "error"])
    return {"ok": False, "error": log.error, "booking_id": booking.id}


def run_outbound_confirmations(provider_id: int, *, limit: int = 10) -> dict:
    vs = ProviderVoiceSettings.objects.filter(
        provider_id=provider_id, enabled=True, confirm_outbound_enabled=True
    ).first()
    if not vs:
        return {"ok": False, "error": "Исходящие отключены или нет настроек.", "dialed": 0}
    pending = pending_confirmation_bookings(provider_id)
    dialed = 0
    errors = []
    for row in pending[:limit]:
        r = dial_booking_confirmation(vs, row["id"])
        if r.get("ok"):
            dialed += 1
        else:
            errors.append({"booking_id": row["id"], "error": r.get("error")})
    return {"ok": True, "dialed": dialed, "errors": errors}


def process_confirmation_response(session: VoiceCallSession, user_text: str) -> dict | None:
    """Handle yes/no on outbound confirm call. Returns {say, action, booking_id} or None."""
    ctx = session.context or {}
    if ctx.get("mode") != "confirm":
        return None
    booking_id = ctx.get("booking_id")
    if not booking_id:
        return None

    if not (user_text or "").strip():
        return {
            "say": ctx.get("confirm_script") or "Подтверждаете запись? Скажите да или нет.",
            "action": "continue",
            "booking_id": None,
        }

    t = user_text.lower().strip()
    yes = any(w in t for w in ("да", "подтвер", "конечно", "yes", "ок", "приду"))
    no = any(w in t for w in ("нет", "отмен", "не смог", "no", "перенес"))

    booking = Booking.objects.filter(pk=booking_id, provider_id=session.provider_id).first()
    if not booking:
        return {"say": "Не нашла запись. До свидания.", "action": "hangup", "booking_id": None}

    if yes and not no:
        if booking.status == Booking.Status.NEW:
            booking.status = Booking.Status.CONFIRMED
            booking.save(update_fields=["status"])
        session.booking_id = booking.id
        session.status = VoiceCallSession.Status.COMPLETED
        session.save(update_fields=["booking_id", "status"])
        VoiceOutboundLog.objects.filter(session=session).update(status=VoiceOutboundLog.Status.DONE)
        return {
            "say": "Спасибо, ждём вас! До свидания.",
            "action": "hangup",
            "booking_id": booking.id,
        }
    if no:
        booking.status = Booking.Status.CANCELLED
        booking.save(update_fields=["status"])
        try:
            from booking.booking_actions import release_booking_occupancy

            release_booking_occupancy(booking)
        except Exception:
            logger.exception("release on voice cancel")
        session.status = VoiceCallSession.Status.COMPLETED
        session.save(update_fields=["status"])
        VoiceOutboundLog.objects.filter(session=session).update(status=VoiceOutboundLog.Status.DONE)
        return {
            "say": "Запись отменена. Если захотите записаться снова — звоните или заходите на сайт. До свидания.",
            "action": "hangup",
            "booking_id": booking.id,
        }

    return {
        "say": "Пожалуйста, скажите «да» для подтверждения или «нет» для отмены.",
        "action": "continue",
        "booking_id": None,
    }
