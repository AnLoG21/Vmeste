"""Уведомления кабинета маркетплейсов (Telegram org + push владельцу/сотрудникам)."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _staff_recipient_ids(provider) -> list[int]:
    from booking.models import ProviderStaff

    ids = {int(provider.id)}
    for link in ProviderStaff.objects.filter(
        provider=provider,
        is_active=True,
        invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
    ).only("staff_id", "permissions"):
        perms = link.permissions if isinstance(link.permissions, dict) else {}
        if (
            perms.get("marketplace_manage_orders", True)
            or perms.get("marketplace_view_keys")
            or perms.get("marketplace_manage_catalog")
        ):
            ids.add(int(link.staff_id))
    return list(ids)


def notify_marketplace(provider, *, title: str, body: str, kind: str = "marketplace", payload: dict | None = None) -> dict:
    """Send Telegram (org chat) and/or push+in-app according to MarketplaceSettings."""
    from notifications.channels import send_telegram
    from notifications.delivery import get_or_create_messaging
    from notifications.push import notify_users

    from .models import MarketplaceSettings

    result = {"telegram": False, "push": 0}
    try:
        s, _ = MarketplaceSettings.objects.get_or_create(provider=provider)
    except Exception:
        logger.exception("marketplace settings load failed")
        return result

    text = f"{title}\n{body}".strip()
    if s.notify_telegram:
        try:
            msg = get_or_create_messaging(provider)
            token = msg.resolved_telegram_bot_token()
            chat_id = (msg.telegram_notify_chat_id or "").strip()
            if msg.enable_telegram and token and chat_id:
                result["telegram"] = bool(send_telegram(bot_token=token, chat_id=chat_id, text=text[:3500]))
        except Exception:
            logger.exception("marketplace telegram notify failed")

    if s.notify_push:
        try:
            notify_users(
                _staff_recipient_ids(provider),
                kind=kind,
                title=title[:120],
                body=body[:240],
                payload=payload or {"sphere": "marketplaces"},
            )
            result["push"] = 1
        except Exception:
            logger.exception("marketplace push notify failed")
    return result


def notify_sync_error(provider, *, detail: str) -> None:
    from .models import MarketplaceSettings

    s = MarketplaceSettings.objects.filter(provider=provider).first()
    if not s or not s.notify_on_sync_errors:
        return
    notify_marketplace(
        provider,
        title="Маркетплейсы: ошибка синка",
        body=str(detail or "Сбой фоновой синхронизации")[:400],
        kind="marketplace_sync_error",
    )


def notify_new_orders(provider, *, marketplace: str, count: int, sample: list[str]) -> None:
    from .models import MarketplaceSettings

    s = MarketplaceSettings.objects.filter(provider=provider).first()
    if not s or not s.notify_on_new_orders or count <= 0:
        return
    label = "Wildberries" if marketplace == "wildberries" else "Ozon"
    sample_txt = ", ".join(sample[:5]) if sample else ""
    notify_marketplace(
        provider,
        title=f"Новые заказы {label}: {count}",
        body=sample_txt or f"Появилось заказов: {count}",
        kind="marketplace_new_order",
        payload={"marketplace": marketplace, "count": count},
    )
