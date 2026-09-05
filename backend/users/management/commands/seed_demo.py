from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from users.demo import DEMO_SPHERES, ensure_demo_world


class Command(BaseCommand):
    help = "Создаёт общие демо-кабинеты (салон, автосервис, кафе, маркетплейсы) с тестовыми данными."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sphere",
            choices=list(DEMO_SPHERES),
            help="Только одна сфера. По умолчанию — все.",
        )
        parser.add_argument(
            "--no-reset",
            action="store_true",
            help="Не удалять пользовательские демо-данные, только досоздать seed.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Разрешить seed вне DEBUG (нужен также ALLOW_DEMO_SEED=1).",
        )

    def handle(self, *args, **options):
        import os

        allow = os.environ.get("ALLOW_DEMO_SEED", "").strip() == "1"
        if not settings.DEBUG and not (options.get("force") and allow):
            raise CommandError(
                "seed_demo на проде отключён. Для staging: ALLOW_DEMO_SEED=1 и --force "
                "(или SEED_DEMO_ON_DEPLOY только на не-prod)."
            )
        ensure_demo_world(sphere=options.get("sphere"), reset=not options.get("no_reset"))
        self.stdout.write(self.style.SUCCESS("Демо-кабинеты готовы."))
