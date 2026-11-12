from django.core.management.base import BaseCommand

from vmagnitol.models import Brand, CarModel, Guide, GuideStep


COOLRAY_STEPS = [
    {
        "order": 1,
        "title": "Подготовка и риски",
        "body": (
            "Перед любыми работами зафиксируйте VIN, версию прошивки ГУ, комплектацию и наличие 360/кастомных "
            "модулей. Сохраните фото экранов «О системе». Работы на свой страх и риск: неверный образ может "
            "оставить ГУ в brick. Заранее подготовьте ноутбук, качественную флешку и стабильное питание."
        ),
        "warning": "Не отключайте АКБ и питание ГУ во время прошивки.",
    },
    {
        "order": 2,
        "title": "Бэкап текущего ПО и настроек",
        "body": (
            "Снимите полный бэкап текущего ПО (factory / update package / EMMC dump — по доступному методу для "
            "вашей ревизии). Сохраните код активации, настройки радио, Bluetooth-пары и логин онлайн-сервисов. "
            "Файлы бэкапа приложите к этому шагу."
        ),
        "warning": "Без бэкапа откат может быть невозможен.",
    },
    {
        "order": 3,
        "title": "Определение ревизии магнитолы",
        "body": (
            "Уточните MCU/Android build, размер экрана, процессор и наличие DSP. От этого зависит выбор образа "
            "и способ входа в engineering/update. Занесите ревизию в заметки модели."
        ),
        "warning": "",
    },
    {
        "order": 4,
        "title": "Разблокировка / engineering menu",
        "body": (
            "Опишите актуальный способ входа в engineering/диагностику для данной ревизии Coolray "
            "(код, комбинация, ADB, кабель). Добавьте скриншоты и файлы утилит к шагу."
        ),
        "warning": "Не делитесь публично приватными кодами дилера без необходимости.",
    },
    {
        "order": 5,
        "title": "Прошивка образа",
        "body": (
            "Пошагово: подготовка носителя → копирование пакета → вход в update → подтверждение → ожидание. "
            "После перезагрузки проверьте версию ПО и базовые функции (радио, камера, климат-виджеты)."
        ),
        "warning": "Не выключайте зажигание до полного завершения.",
    },
    {
        "order": 6,
        "title": "Русификация и локализация",
        "body": (
            "Установка русского языкового пакета / замена системных строк / настройка клавиатуры и TTS. "
            "Проверьте меню, навигацию и голосовые подсказки. Приложите архивы локализации к шагу."
        ),
        "warning": "",
    },
    {
        "order": 7,
        "title": "Проверка и доводка",
        "body": (
            "Чеклист: камеры, парктроник, рулевое управление медиа, зарядка, CarPlay/Android Auto (если есть), "
            "онлайн-сервисы. Зафиксируйте итоговые версии и известные баги модели."
        ),
        "warning": "",
    },
]


class Command(BaseCommand):
    help = "Seed Geely Coolray starter guide for Вмагнитоле"

    def handle(self, *args, **options):
        brand, _ = Brand.objects.get_or_create(
            slug="geely",
            defaults={"name": "Geely", "notes": "Китайские ГУ, часто Android-based.", "sort_order": 10},
        )
        model, _ = CarModel.objects.get_or_create(
            brand=brand,
            slug="coolray",
            defaults={
                "name": "Coolray",
                "years": "2019+",
                "head_unit": "Штатная мультимедиа (уточнять ревизию)",
                "notes": "Стартовый каркас под поэтапные инструкции и файлы.",
                "sort_order": 10,
            },
        )
        guide, created = Guide.objects.get_or_create(
            car_model=model,
            title="Прошивка и русификация штатной магнитолы",
            defaults={
                "summary": (
                    "Рабочий каркас гайда: бэкап → ревизия → разблокировка → прошивка → русификация → проверка. "
                    "Дополняйте шаги своими деталями и файлами. Ориентир обсуждений: 4PDA Geely Coolray."
                ),
                "status": Guide.Status.PUBLISHED,
                "source_url": "https://4pda.to/forum/index.php?showtopic=1001500",
            },
        )
        if created or guide.steps.count() == 0:
            for step in COOLRAY_STEPS:
                GuideStep.objects.update_or_create(
                    guide=guide,
                    order=step["order"],
                    defaults={
                        "title": step["title"],
                        "body": step["body"],
                        "warning": step["warning"],
                    },
                )
            self.stdout.write(self.style.SUCCESS(f"Seeded guide #{guide.id} with {len(COOLRAY_STEPS)} steps"))
        else:
            self.stdout.write(f"Guide already present: #{guide.id}")
