"""Unified booking event delivery across push, SMS, Telegram, MAX, WhatsApp."""

from __future__ import annotations

import logging

from django.conf import settings

from .channels import send_max, send_sms_ru, send_telegram, send_whatsapp_greenapi
from .models import InAppNotification, SmsLog

logger = logging.getLogger(__name__)


def get_or_create_messaging(provider):
    from booking.models import ProviderMessagingSettings

    obj, _ = ProviderMessagingSettings.objects.get_or_create(provider=provider)
    return obj


def render_reminder_template(tpl: str, *, org: str, service: str, date: str) -> str:
    return (
        (tpl or "")
        .replace("{org}", org or "")
        .replace("{service}", service or "")
        .replace("{date}", date or "")
    )


def _sms_api_id(msg_settings) -> str:
    org = (getattr(msg_settings, "sms_api_id", None) or "").strip()
    if org:
        return org
    return (getattr(settings, "SMSRU_API_ID", None) or "").strip()


def _send_sms(user, phone: str, text: str, api_id: str) -> None:
    if not phone or not text or not api_id:
        return
    ok, status = send_sms_ru(api_id=api_id, phone=phone, text=text)
    try:
        SmsLog.objects.create(
            user=user if getattr(user, "pk", None) else None,
            phone=phone[:30],
            text=text[:255],
            status="sent" if ok else status or "failed",
        )
    except Exception:
        logger.exception("SmsLog create failed")


def _org_recipients(booking) -> list[int]:
    ids = {booking.provider_id}
    if booking.staff_id:
        ids.add(booking.staff_id)
    return list(ids)


def _org_phone(provider) -> str:
    phones = getattr(provider, "organization_phones", None) or []
    if isinstance(phones, list) and phones:
        first = phones[0]
        if isinstance(first, str):
            return first.strip()
        if isinstance(first, dict):
            return str(first.get("phone") or first.get("number") or "").strip()
    return (getattr(provider, "phone", None) or "").strip()


def _telegram_bot_token(msg) -> str:
    return msg.resolved_telegram_bot_token()


def _fanout_org_channels(msg, provider, text: str) -> None:
    tg_token = _telegram_bot_token(msg)
    if msg.enable_telegram and tg_token and (msg.telegram_notify_chat_id or "").strip():
        send_telegram(bot_token=tg_token, chat_id=msg.telegram_notify_chat_id, text=text)
    if msg.enable_max and msg.has_max():
        send_max(bot_token=msg.max_bot_token, chat_id=msg.max_notify_chat_id, text=text)
    if msg.enable_whatsapp and msg.has_whatsapp():
        phone = _org_phone(provider)
        if phone:
            send_whatsapp_greenapi(
                api_url=msg.wa_api_url,
                id_instance=msg.wa_id_instance,
                api_token=msg.wa_api_token,
                phone=phone,
                text=text,
            )


def deliver_booking_event(
    booking,
    event: str,
    text: str,
    *,
    audience: str = "both",
    title_client: str = "",
    title_org: str = "",
) -> None:
    """
    event: remind_24h | remind_2h | confirm | cancel | done | new | cancel_by_client
    audience: client | org | both
    """
    from booking.booking_actions import booking_notification_payload
    from notifications.push import notify_users

    msg = get_or_create_messaging(booking.provider)
    client = getattr(booking, "client", None)
    body = (text or "").strip()
    payload = booking_notification_payload(booking)

    is_reminder = event in ("remind_24h", "remind_2h")
    is_status = event in ("confirm", "cancel", "done")

    # ——— Client ———
    if audience in ("client", "both") and client and client.pk:
        allow = True
        if is_reminder:
            allow = bool(msg.remind_clients and getattr(client, "notify_booking_reminders", True))
        elif is_status:
            allow = bool(getattr(client, "notify_booking_status", True))
        if allow:
            try:
                notify_users(
                    [client.pk],
                    kind=InAppNotification.Kind.BOOKING,
                    title=(title_client or "Запись")[:120],
                    body=(body[:240] or title_client),
                    payload=payload,
                )
            except Exception:
                logger.exception("client push failed")

            if msg.enable_sms:
                api_id = _sms_api_id(msg)
                phone = (getattr(client, "phone", None) or "").strip()
                if api_id and phone:
                    _send_sms(client, phone, body, api_id)

            tg_token = _telegram_bot_token(msg)
            if msg.enable_telegram and (client.telegram_chat_id or "").strip() and tg_token:
                send_telegram(bot_token=tg_token, chat_id=client.telegram_chat_id, text=body)
            if msg.enable_max and (client.max_user_id or "").strip() and (msg.max_bot_token or "").strip():
                send_max(bot_token=msg.max_bot_token, chat_id=client.max_user_id, text=body)
            if msg.enable_whatsapp and msg.has_whatsapp():
                phone = (getattr(client, "phone", None) or "").strip()
                if phone:
                    send_whatsapp_greenapi(
                        api_url=msg.wa_api_url,
                        id_instance=msg.wa_id_instance,
                        api_token=msg.wa_api_token,
                        phone=phone,
                        text=body,
                    )

    # ——— Organization ———
    if audience not in ("org", "both"):
        return

    allow_org = False
    if event == "new":
        allow_org = bool(msg.notify_org_on_new)
    elif event == "cancel_by_client":
        allow_org = True
    elif is_reminder:
        allow_org = bool(msg.remind_org)
    # confirm/cancel/done by org: do not re-ping org

    if not allow_org:
        return

    try:
        notify_users(
            _org_recipients(booking),
            kind=InAppNotification.Kind.BOOKING,
            title=(title_org or "Запись")[:120],
            body=(body[:240] or title_org),
            payload=payload,
        )
    except Exception:
        logger.exception("org push failed")

    _fanout_org_channels(msg, booking.provider, body)


def build_reminder_text(booking) -> str:
    from booking.booking_actions import format_booking_when

    msg = get_or_create_messaging(booking.provider)
    org = (getattr(booking.provider, "organization_name", None) or "").strip() or "Организация"
    service = getattr(getattr(booking, "service", None), "name", None) or "услуга"
    date = format_booking_when(booking)
    return render_reminder_template(msg.reminder_text(), org=org, service=service, date=date)
