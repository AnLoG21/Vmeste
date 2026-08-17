"""Platform Telegram bot: client/org linking and chat_id helper."""

from __future__ import annotations

import logging

from django.conf import settings

from .channels import send_telegram

logger = logging.getLogger(__name__)

ORG_START_PREFIX = "org_"


def platform_bot_token() -> str:
    return (getattr(settings, "TELEGRAM_BOT_TOKEN", None) or "").strip()


def platform_bot_username() -> str:
    return (getattr(settings, "TELEGRAM_BOT_USERNAME", None) or "").strip()


def org_start_param(link_token: str) -> str:
    return f"{ORG_START_PREFIX}{link_token}"


def org_deep_link(link_token: str) -> str:
    username = platform_bot_username()
    if not username or not link_token:
        return ""
    return f"https://t.me/{username}?start={org_start_param(link_token)}"


def client_deep_link(link_token: str) -> str:
    username = platform_bot_username()
    if not username or not link_token:
        return ""
    return f"https://t.me/{username}?start={link_token}"


def _reply(chat_id: str, text: str) -> None:
    token = platform_bot_token()
    if not token or not chat_id or not text:
        return
    send_telegram(bot_token=token, chat_id=chat_id, text=text)


def _chat_id_help(chat_id: str) -> str:
    username = platform_bot_username()
    bot = f"@{username}" if username else "бота Вместе"
    return (
        f"Ваш Chat ID: {chat_id}\n\n"
        f"Организация: в кабинете Вместе → «Напоминания и мессенджеры» → "
        f"«Привязать Telegram» → откройте {bot} по ссылке.\n"
        f"Клиент: в настройках профиля → «Telegram» → ссылка на того же бота.\n\n"
        f"Можно вписать Chat ID вручную или привязаться автоматически по ссылке."
    )


def handle_telegram_update(update: dict) -> None:
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "")
    text = str(message.get("text") or "").strip()
    if not chat_id or not text:
        return

    lower = text.lower()
    if lower.startswith("/chatid"):
        _reply(chat_id, f"Ваш Chat ID: {chat_id}")
        return

    if not text.startswith("/start"):
        return

    parts = text.split(maxsplit=1)
    arg = (parts[1] if len(parts) > 1 else "").strip()

    if arg.startswith(ORG_START_PREFIX):
        _bind_org(chat_id, arg[len(ORG_START_PREFIX) :])
        return

    if arg:
        _bind_client(chat_id, arg)
        return

    _reply(chat_id, _chat_id_help(chat_id))


def _bind_org(chat_id: str, link_token: str) -> None:
    from booking.models import ProviderMessagingSettings

    msg = ProviderMessagingSettings.objects.filter(telegram_org_link_token=link_token).select_related("provider").first()
    if not msg:
        _reply(
            chat_id,
            "Код привязки организации не найден. Откройте ссылку из кабинета Вместе заново.",
        )
        return
    msg.telegram_notify_chat_id = chat_id
    if not msg.enable_telegram:
        msg.enable_telegram = True
    msg.save(update_fields=["telegram_notify_chat_id", "enable_telegram"])
    org_name = (getattr(msg.provider, "organization_name", None) or "").strip() or "организация"
    _reply(
        chat_id,
        f"Telegram привязан для «{org_name}».\nChat ID: {chat_id}\n\n"
        "Уведомления о записях будут приходить сюда, если включены в настройках организации.",
    )


def _bind_client(chat_id: str, link_token: str) -> None:
    from users.models import User

    user = User.objects.filter(telegram_link_token=link_token).first()
    if not user:
        _reply(chat_id, _chat_id_help(chat_id))
        return
    user.telegram_chat_id = chat_id
    user.save(update_fields=["telegram_chat_id"])
    _reply(
        chat_id,
        "Telegram привязан к аккаунту Вместе. Вы будете получать напоминания о записях.",
    )
