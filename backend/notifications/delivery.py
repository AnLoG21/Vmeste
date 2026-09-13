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


def render_reminder_template(tpl: str, *, org: str = "", service: str = "", date: str = "", client: str = "", **extra) -> str:
    text = (
        (tpl or "")
        .replace("{org}", org or "")
        .replace("{service}", service or "")
        .replace("{date}", date or "")
        .replace("{client}", client or "")
    )
    for key, val in (extra or {}).items():
        text = text.replace("{" + str(key) + "}", str(val if val is not None else ""))
    return text


def _sms_api_id(msg_settings) -> str:
    org = (getattr(msg_settings, "sms_api_id", None) or "").strip()
    if org:
        return org
    return (getattr(settings, "SMSRU_API_ID", None) or "").strip()


def _send_sms(user, phone: str, text: str, api_id: str) -> bool:
    if not phone or not text or not api_id:
        return False
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
    return bool(ok)


def _org_recipients(booking) -> list[int]:
    """Provider + assigned master, or staff with manage_bookings if no master yet."""
    ids = {int(booking.provider_id)}
    if booking.staff_id:
        ids.add(int(booking.staff_id))
        return list(ids)
    from booking.models import ProviderStaff

    for link in ProviderStaff.objects.filter(
        provider_id=booking.provider_id,
        is_active=True,
        invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
    ).only("staff_id", "permissions"):
        perms = link.permissions if isinstance(link.permissions, dict) else {}
        if perms.get("manage_bookings"):
            ids.add(int(link.staff_id))
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


def _send_booking_email(user, subject: str, text: str) -> bool:
    if getattr(user, "is_demo", False):
        return False
    email = (getattr(user, "email", None) or "").strip()
    if not email or "@" not in email:
        return False
    try:
        from users.email_service import send_booking_notification_email

        return bool(send_booking_notification_email(to=email, subject=subject, text_body=text))
    except Exception:
        logger.exception("booking email failed")
        return False


def _fanout_user_channels(msg, user, text: str) -> None:
    if not user or not getattr(user, "pk", None):
        return
    tg_token = _telegram_bot_token(msg)
    if msg.enable_telegram and tg_token and (getattr(user, "telegram_chat_id", None) or "").strip():
        send_telegram(bot_token=tg_token, chat_id=user.telegram_chat_id, text=text)
    if msg.enable_max and (getattr(user, "max_user_id", None) or "").strip() and (msg.max_bot_token or "").strip():
        send_max(bot_token=msg.max_bot_token, chat_id=user.max_user_id, text=text)
    if msg.enable_whatsapp and msg.has_whatsapp():
        phone = (getattr(user, "phone", None) or "").strip()
        if phone:
            send_whatsapp_greenapi(
                api_url=msg.wa_api_url,
                id_instance=msg.wa_id_instance,
                api_token=msg.wa_api_token,
                phone=phone,
                text=text,
            )
    if msg.enable_sms:
        api_id = _sms_api_id(msg)
        phone = (getattr(user, "phone", None) or "").strip()
        if api_id and phone:
            _send_sms(user, phone, text, api_id)
    if getattr(msg, "enable_email", False):
        _send_booking_email(user, "Напоминание о записи", text)


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
    is_status = event in ("confirm", "cancel", "done", "new_client", "client_confirm", "no_show")

    # ——— Client ———
    if audience in ("client", "both") and client and client.pk:
        allow = True
        if is_reminder:
            allow = bool(msg.remind_clients and getattr(client, "notify_booking_reminders", True))
        elif event == "new_client":
            allow = bool(getattr(msg, "notify_client_on_new", True) and getattr(client, "notify_booking_status", True))
        elif is_status:
            allow = bool(getattr(client, "notify_booking_status", True))
        if allow:
            # new_client: short push, no inbox spam; full text (with URL) only on email/SMS/messengers
            push_body = body
            inbox = True
            if event == "new_client":
                inbox = False
                push_body = _short_client_booking_push(booking, title_client or "Вы записаны")
            try:
                notify_users(
                    [client.pk],
                    kind=InAppNotification.Kind.BOOKING,
                    title=(title_client or "Запись")[:120],
                    body=(push_body[:240] or title_client),
                    payload={**payload, "view": "bookings", "event": event},
                    inbox=inbox,
                )
            except Exception:
                logger.exception("client push failed")

            channel_ok = False
            sms_wanted = False
            tg_wanted = False

            if msg.enable_sms:
                api_id = _sms_api_id(msg)
                phone = (getattr(client, "phone", None) or "").strip()
                if api_id and phone:
                    sms_wanted = True
                    if _send_sms(client, phone, body, api_id):
                        channel_ok = True

            tg_token = _telegram_bot_token(msg)
            if msg.enable_telegram and (client.telegram_chat_id or "").strip() and tg_token:
                tg_wanted = True
                if send_telegram(bot_token=tg_token, chat_id=client.telegram_chat_id, text=body):
                    channel_ok = True
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
            if getattr(msg, "enable_email", False):
                subj = title_client or ("Напоминание о записи" if is_reminder else "Запись")
                if _send_booking_email(client, subj, body):
                    channel_ok = True

            # SMS/TG — стабильный канал: не помечаем reminder sent, если канал включён, но не ушёл.
            if is_reminder and (sms_wanted or tg_wanted) and not channel_ok:
                raise RuntimeError("reminder SMS/Telegram delivery failed")

    # ——— Organization ———
    if audience not in ("org", "both"):
        return

    allow_org = False
    if event == "new":
        allow_org = bool(msg.notify_org_on_new)
    elif event == "cancel_by_client":
        allow_org = True
    elif event == "client_confirm":
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
            payload={**payload, "view": "bookings", "event": event, "audience": "org"},
        )
    except Exception:
        logger.exception("org push failed")

    _fanout_org_channels(msg, booking.provider, body)
    staff = getattr(booking, "staff", None)
    if staff and staff.pk and staff.pk != booking.provider_id:
        allow_staff = True
        if is_reminder:
            allow_staff = bool(getattr(staff, "notify_booking_reminders", True))
        if allow_staff:
            _fanout_user_channels(msg, staff, body)


def enqueue_deliver_booking_event(
    booking,
    event: str,
    text: str,
    *,
    audience: str = "both",
    title_client: str = "",
    title_org: str = "",
) -> None:
    """
    Queue booking fan-out so HTTP create/confirm stays fast.
    Falls back to a daemon thread if the broker is unavailable / eager would block.
    """
    booking_id = int(booking.pk)
    body = (text or "").strip()
    title_client = title_client or ""
    title_org = title_org or ""

    def _run_inline():
        from django.db import close_old_connections

        close_old_connections()
        try:
            from booking.models import Booking

            b = (
                Booking.objects.select_related("provider", "client", "service", "staff", "slot")
                .filter(pk=booking_id)
                .first()
            )
            if not b:
                return
            deliver_booking_event(
                b,
                event,
                body,
                audience=audience,
                title_client=title_client,
                title_org=title_org,
            )
        except Exception:
            logger.exception("inline booking delivery failed booking_id=%s event=%s", booking_id, event)
        finally:
            close_old_connections()

    try:
        from django.conf import settings

        from .tasks import deliver_booking_event_task

        # ALWAYS_EAGER would re-block the request — prefer a background thread in that mode.
        if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
            import threading

            threading.Thread(target=_run_inline, daemon=True, name=f"booking-notify-{booking_id}").start()
            return
        deliver_booking_event_task.delay(
            booking_id,
            event,
            body,
            audience,
            title_client,
            title_org,
        )
    except Exception:
        logger.exception("celery enqueue failed; using thread booking_id=%s", booking_id)
        import threading

        threading.Thread(target=_run_inline, daemon=True, name=f"booking-notify-{booking_id}").start()


def _booking_template_vars(booking) -> dict:
    from booking.booking_actions import client_display_name, format_booking_when

    org = (getattr(booking.provider, "organization_name", None) or "").strip() or "Организация"
    service = getattr(getattr(booking, "service", None), "name", None) or "услуга"
    date = format_booking_when(booking)
    client = client_display_name(getattr(booking, "client", None))
    confirm_url = ""
    try:
        from booking.client_booking_views import build_client_confirm_url

        msg = get_or_create_messaging(booking.provider)
        if getattr(msg, "send_client_confirm_link", True):
            confirm_url = build_client_confirm_url(booking)
    except Exception:
        confirm_url = ""
    return {
        "org": org,
        "service": service,
        "date": date,
        "client": client,
        "confirm_url": confirm_url,
    }


def build_reminder_text(booking) -> str:
    msg = get_or_create_messaging(booking.provider)
    return render_reminder_template(msg.reminder_text(), **_booking_template_vars(booking))


def build_new_booking_text(booking) -> str:
    msg = get_or_create_messaging(booking.provider)
    return render_reminder_template(msg.new_booking_text(), **_booking_template_vars(booking))


def build_client_new_booking_text(booking) -> str:
    msg = get_or_create_messaging(booking.provider)
    vars_ = _booking_template_vars(booking)
    tpl = msg.client_new_booking_text()
    # Если ссылку отключили — убираем хвост про подтверждение
    if not vars_.get("confirm_url"):
        tpl = (
            tpl.replace(" Подтвердите визит: {confirm_url}", "")
            .replace("Подтвердите визит: {confirm_url}", "")
            .replace("{confirm_url}", "")
            .replace(" Подтвердите визит в кабинете Вместе.", "")
            .strip()
        )
        if not tpl:
            tpl = "Вы записаны в {org} на {service} — {date}."
    # Для каналов с длинным URL: если шаблон всё ещё содержит {confirm_url}, оставляем.
    # Если нет — добавляем короткую отдельную строку только в email/SMS/мессенджеры.
    text = render_reminder_template(tpl, **vars_)
    confirm = (vars_.get("confirm_url") or "").strip()
    if confirm and "{confirm_url}" not in tpl and "confirm_url" not in (tpl or ""):
        if confirm not in text:
            text = f"{text.rstrip()}\nПодтвердить: {confirm}"
    return text


def _short_client_booking_push(booking, fallback_title: str) -> str:
    from booking.booking_actions import format_booking_when

    org = (getattr(booking.provider, "organization_name", None) or "").strip() or "организацию"
    service = getattr(getattr(booking, "service", None), "name", None) or "услугу"
    when = format_booking_when(booking)
    return f"Вы записаны: {service} · {when} · {org}"[:180] or fallback_title


def deliver_winback_message(provider, client, text: str, *, title: str = "Мы скучаем") -> None:
    """Client-only CRM message (no booking object)."""
    from notifications.push import notify_users

    msg = get_or_create_messaging(provider)
    if not msg.remind_clients:
        return
    if not client or not getattr(client, "notify_booking_reminders", True):
        return
    body = (text or "").strip()
    if not body:
        return
    try:
        notify_users(
            [client.pk],
            kind=InAppNotification.Kind.BOOKING,
            title=(title or "Напоминание")[:120],
            body=body[:240],
            payload={"provider_id": provider.pk, "event": "winback"},
        )
    except Exception:
        logger.exception("winback push failed")

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
    if getattr(msg, "enable_email", False):
        _send_booking_email(client, title or "Мы скучаем", body)
