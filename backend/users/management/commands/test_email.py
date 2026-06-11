from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Проверка отправки почты через SMTP (Gmail)"

    def add_arguments(self, parser):
        parser.add_argument(
            "recipient",
            nargs="?",
            default=settings.SUPPORT_EMAIL,
            help="Email получателя (по умолчанию SUPPORT_EMAIL)",
        )

    def handle(self, *args, **options):
        if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
            raise CommandError(
                "Заполните EMAIL_HOST_USER и EMAIL_HOST_PASSWORD в .env, затем перезапустите: docker compose restart web"
            )
        recipient = options["recipient"]
        self.stdout.write(f"SMTP: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
        self.stdout.write(f"От: {settings.DEFAULT_FROM_EMAIL}")
        self.stdout.write(f"Кому: {recipient}")
        try:
            send_mail(
                "Vmeste — тест почты",
                "Если вы видите это письмо, Gmail настроен правильно.",
                settings.DEFAULT_FROM_EMAIL,
                [recipient],
                fail_silently=False,
            )
        except Exception as e:
            err = str(e)
            if "535" in err or "BadCredentials" in err:
                raise CommandError(
                    "Gmail отклонил пароль (535). Нужен пароль приложения, не обычный пароль:\n"
                    "  1. https://myaccount.google.com/apppasswords\n"
                    "  2. Создайте пароль для «Почта» → «Другое (Vmeste)»\n"
                    "  3. Вставьте 16 символов в EMAIL_HOST_PASSWORD (без пробелов)\n"
                    "  4. docker compose up -d --force-recreate web"
                ) from e
            raise CommandError(f"Ошибка SMTP: {e}") from e
        self.stdout.write(self.style.SUCCESS("Письмо отправлено успешно."))
