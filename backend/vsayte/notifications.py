"""Уведомления Всайте (заявки и т.п.)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def notify_owner_new_lead(site, lead) -> bool:
    owner = getattr(site, "owner", None)
    to = (getattr(owner, "email", None) or "").strip()
    if not to:
        return False
    subject = f"Всайте: новая заявка — {site.title}"
    lines = [
        f"Сайт: {site.title} ({site.slug})",
        f"Имя: {lead.name or '—'}",
        f"Контакт: {lead.contact or '—'}",
        f"Сообщение: {lead.message or '—'}",
        f"Страница: {lead.page_url or '—'}",
        "",
        "Открыть заявки можно в кабинете Всайте.",
    ]
    front = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    if front:
        lines.append(f"{front}/vsayte")
    try:
        send_mail(
            subject=subject,
            message="\n".join(lines),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
            recipient_list=[to],
            fail_silently=True,
        )
        return True
    except Exception:
        logger.exception("Failed to send vsayte lead email for site %s", site.pk)
        return False
