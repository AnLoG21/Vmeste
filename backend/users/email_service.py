import logging
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, send_mail
from django.core import signing

logger = logging.getLogger(__name__)

SITE_BRAND = "Вместе"
PASSWORD_CHANGE_SALT = "vmeste-password-change"
EMAIL_CHANGE_SALT = "vmeste-email-change"


def _can_send() -> bool:
    return bool(getattr(settings, "EMAIL_HOST_USER", "") and getattr(settings, "EMAIL_HOST_PASSWORD", ""))


def _from_email() -> str:
    raw = (getattr(settings, "DEFAULT_FROM_EMAIL", "") or "").strip()
    if raw:
        # Prefer Russian brand in From display name
        if raw.lower().startswith("vmeste"):
            addr = raw.split("<")[-1].rstrip(">").strip() if "<" in raw else "vmesteofficialsupport@gmail.com"
            return f"{SITE_BRAND} <{addr}>"
        return raw
    return f"{SITE_BRAND} <vmesteofficialsupport@gmail.com>"


def _wrap_html(*, title: str, greeting: str, paragraphs: list[str], button_url: str = "", button_label: str = "") -> str:
    paras = "".join(f"<p style=\"margin:0 0 14px;line-height:1.5;color:#333;\">{escape(p)}</p>" for p in paragraphs if p)
    btn = ""
    if button_url and button_label:
        btn = (
            f'<p style="margin:24px 0;">'
            f'<a href="{escape(button_url)}" style="display:inline-block;background:#ff7a00;color:#fff;'
            f'text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">'
            f"{escape(button_label)}</a></p>"
            f'<p style="margin:0 0 14px;font-size:13px;color:#666;word-break:break-all;">'
            f"Или откройте ссылку:<br>{escape(button_url)}</p>"
        )
    return f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>{escape(title)}</title></head>
<body style="margin:0;padding:0;background:#fff8f2;font-family:Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8f2;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #ffd9bd;border-radius:14px;padding:24px;">
        <tr><td>
          <div style="font-size:22px;font-weight:700;color:#ff7a00;margin-bottom:4px;">📬 {escape(SITE_BRAND)}</div>
          <div style="font-size:13px;color:#8d5a2b;margin-bottom:18px;">онлайн-запись и автоматизация бизнеса</div>
          <h1 style="margin:0 0 16px;font-size:18px;color:#1a1a1a;">{escape(title)}</h1>
          <p style="margin:0 0 14px;line-height:1.5;color:#333;">{escape(greeting)}</p>
          {paras}
          {btn}
          <p style="margin:28px 0 0;font-size:13px;color:#888;">— Команда {escape(SITE_BRAND)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _send_branded(*, to: str, subject: str, text_body: str, html_body: str) -> bool:
    if not _can_send():
        logger.warning("SMTP не настроен. Письмо «%s» для %s:\n%s", subject, to, text_body)
        return False
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=_from_email(),
        to=[to],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)
    return True


def send_verification_email(user) -> bool:
    if not user.email_verification_token:
        return False
    link = f"{settings.FRONTEND_URL}/verify-email?token={user.email_verification_token}"
    name = user.first_name or user.username
    subject = f"Подтверждение регистрации — {SITE_BRAND}"
    text = (
        f"Здравствуйте, {name}!\n\n"
        f"Для завершения регистрации на сервисе «{SITE_BRAND}» перейдите по ссылке:\n{link}\n\n"
        f"Если вы не регистрировались, просто проигнорируйте это письмо.\n\n"
        f"— Команда {SITE_BRAND}"
    )
    html = _wrap_html(
        title="Подтвердите email",
        greeting=f"Здравствуйте, {name}!",
        paragraphs=[
            f"Для завершения регистрации на сервисе «{SITE_BRAND}» подтвердите адрес электронной почты.",
            "Если вы не регистрировались, просто проигнорируйте это письмо.",
        ],
        button_url=link,
        button_label="Подтвердить почту",
    )
    return _send_branded(to=user.email, subject=subject, text_body=text, html_body=html)


def send_email_change_email(user) -> bool:
    """Different letter when user changes email (not registration)."""
    if not user.email_verification_token:
        return False
    link = f"{settings.FRONTEND_URL}/verify-email?token={user.email_verification_token}"
    name = user.first_name or user.username
    subject = f"Подтверждение новой почты — {SITE_BRAND}"
    text = (
        f"Здравствуйте, {name}!\n\n"
        f"Вы запросили смену email в сервисе «{SITE_BRAND}».\n"
        f"Чтобы подтвердить новый адрес, перейдите по ссылке:\n{link}\n\n"
        f"Если вы не меняли почту, срочно напишите в поддержку.\n\n"
        f"— Команда {SITE_BRAND}"
    )
    html = _wrap_html(
        title="Подтвердите новую почту",
        greeting=f"Здравствуйте, {name}!",
        paragraphs=[
            f"Вы запросили смену адреса email в сервисе «{SITE_BRAND}».",
            "Нажмите кнопку ниже, чтобы подтвердить новый адрес.",
            "Если это были не вы — напишите в поддержку и не переходите по ссылке.",
        ],
        button_url=link,
        button_label="Подтвердить новую почту",
    )
    return _send_branded(to=user.email, subject=subject, text_body=text, html_body=html)


def make_password_change_token(user, new_password: str) -> str:
    return signing.dumps(
        {"uid": user.id, "np": new_password},
        salt=PASSWORD_CHANGE_SALT,
        compress=True,
    )


def load_password_change_token(token: str, max_age: int = 60 * 60 * 24):
    return signing.loads(token, salt=PASSWORD_CHANGE_SALT, max_age=max_age)


def send_password_change_email(user, token: str) -> bool:
    link = f"{settings.FRONTEND_URL}/confirm-password-change?token={token}"
    name = user.first_name or user.username
    subject = f"Подтверждение смены пароля — {SITE_BRAND}"
    text = (
        f"Здравствуйте, {name}!\n\n"
        f"Вы запросили смену пароля в сервисе «{SITE_BRAND}».\n"
        f"Чтобы подтвердить смену, перейдите по ссылке (действует 24 часа):\n{link}\n\n"
        f"Если вы не запрашивали смену пароля, проигнорируйте письмо — пароль не изменится.\n\n"
        f"— Команда {SITE_BRAND}"
    )
    html = _wrap_html(
        title="Подтвердите смену пароля",
        greeting=f"Здравствуйте, {name}!",
        paragraphs=[
            f"Вы запросили смену пароля в сервисе «{SITE_BRAND}».",
            "Ссылка действует 24 часа. Если это были не вы — просто удалите письмо, пароль не изменится.",
        ],
        button_url=link,
        button_label="Подтвердить смену пароля",
    )
    return _send_branded(to=user.email, subject=subject, text_body=text, html_body=html)


def send_automation_request_email(*, name, email, phone="", telegram="", message="") -> bool:
    support = settings.SUPPORT_EMAIL
    subject = f"[{SITE_BRAND}] Заявка на автоматизацию — {name}"
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
    from django.core.mail import EmailMessage

    message = EmailMessage(
        subject=subject,
        body=body,
        from_email=_from_email(),
        to=[support],
        reply_to=[email],
    )
    message.send(fail_silently=False)
    return True
