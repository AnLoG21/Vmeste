import logging

from django.conf import settings
from django.core.mail import EmailMessage, send_mail

logger = logging.getLogger(__name__)


def _can_send() -> bool:
    return bool(getattr(settings, "EMAIL_HOST_USER", "") and getattr(settings, "EMAIL_HOST_PASSWORD", ""))


def send_verification_email(user) -> bool:
    if not user.email_verification_token:
        return False
    link = f"{settings.FRONTEND_URL}?verify_email={user.email_verification_token}"
    subject = "Подтверждение регистрации на Vmeste"
    body = (
        f"Здравствуйте, {user.first_name or user.username}!\n\n"
        f"Для завершения регистрации на Vmeste перейдите по ссылке:\n{link}\n\n"
        "Если вы не регистрировались на Vmeste, просто проигнорируйте это письмо.\n\n"
        "— Команда Vmeste"
    )
    if not _can_send():
        logger.warning("SMTP не настроен. Ссылка подтверждения: %s", link)
        return False
    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
    return True


def send_automation_request_email(*, name, email, phone="", telegram="", message="") -> bool:
    support = settings.SUPPORT_EMAIL
    subject = f"[Vmeste] Заявка на автоматизацию — {name}"
    lines = [
        "Новая заявка на индивидуальную автоматизацию",
        "",
        f"Имя: {name}",
        f"Email: {email}",
    ]
    if phone:
        lines.append(f"Телефон: {phone}")
    if telegram:
        lines.append(f"Telegram: {telegram}")
    if message:
        lines.append("")
        lines.append("Описание:")
        lines.append(message)
    body = "\n".join(lines)
    if not _can_send():
        logger.warning("SMTP не настроен. Заявка: %s", body)
        return False
    message = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[support],
        reply_to=[email],
    )
    message.send(fail_silently=False)
    return True
