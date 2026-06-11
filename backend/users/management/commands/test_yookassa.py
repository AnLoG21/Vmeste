from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from subscriptions.yookassa_client import create_payment, get_payment


class Command(BaseCommand):
    help = "Проверка подключения к ЮKassa (создание тестового платежа на 1 ₽)"

    def handle(self, *args, **options):
        if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
            raise CommandError(
                "Заполните YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в .env, затем: docker compose restart web"
            )
        self.stdout.write(f"Shop ID: {settings.YOOKASSA_SHOP_ID}")
        result = create_payment(
            amount="1.00",
            description="Vmeste — тест ЮKassa",
            return_url=f"{settings.FRONTEND_URL}?payment=test",
            metadata={"test": "true"},
        )
        if not result:
            raise CommandError("ЮKassa не ответила. Проверьте shopId и секретный ключ.")
        self.stdout.write(self.style.SUCCESS(f"Платёж создан: {result.get('id')}"))
        self.stdout.write(f"Статус: {result.get('status')}")
        url = (result.get("confirmation") or {}).get("confirmation_url")
        if url:
            self.stdout.write(f"Ссылка оплаты: {url}")
        if result.get("id"):
            info = get_payment(result["id"])
            if info:
                self.stdout.write(f"Проверка GET: status={info.get('status')}, test={info.get('test')}")
