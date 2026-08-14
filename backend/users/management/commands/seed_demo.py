from django.core.management.base import BaseCommand

from users.demo import DEMO_SPHERES, ensure_demo_world


class Command(BaseCommand):
    help = "Создаёт общие демо-кабинеты (салон, автосервис, кафе) с тестовыми данными."

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

    def handle(self, *args, **options):
        ensure_demo_world(sphere=options.get("sphere"), reset=not options.get("no_reset"))
        self.stdout.write(self.style.SUCCESS("Демо-кабинеты готовы."))
