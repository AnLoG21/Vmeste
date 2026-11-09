from django.db import migrations, models


def seed_vsayte_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    SubscriptionPlan.objects.update_or_create(
        slug="vsayte-free",
        defaults={
            "name": "Всайте — Бесплатный",
            "description": "Локальный конструктор с базовыми шаблонами. Без публикации в интернет.",
            "price_monthly": "0.00",
            "features": [
                "Базовый редактор",
                "1 сайт, до 2 страниц",
                "Локальный preview",
                "Без публикации",
            ],
            "is_active": True,
            "sort_order": 100,
            "plan_type": "free",
            "product_kind": "vsayte",
            "voice_minutes_monthly": 0,
            "trial_days": 0,
        },
    )
    SubscriptionPlan.objects.update_or_create(
        slug="vsayte-hosting",
        defaults={
            "name": "Всайте — Хостинг",
            "description": "Публикация на поддомене *.vsayte.vsevmeste.space.",
            "price_monthly": "300.00",
            "features": [
                "Базовый редактор",
                "До 3 сайтов",
                "Публикация на поддомене",
                "Хостинг сайта",
            ],
            "is_active": True,
            "sort_order": 110,
            "plan_type": "paid",
            "product_kind": "vsayte",
            "voice_minutes_monthly": 0,
            "trial_days": 0,
        },
    )
    SubscriptionPlan.objects.update_or_create(
        slug="vsayte-pro",
        defaults={
            "name": "Всайте — Pro",
            "description": "Полный конструктор, все шаблоны и шрифты, свой домен через REG.RU.",
            "price_monthly": "990.00",
            "features": [
                "Полный конструктор",
                "Все шаблоны, палитры и шрифты",
                "Загрузка своих файлов",
                "Поддомен или свой домен",
                "Покупка домена через REG.RU",
            ],
            "is_active": True,
            "sort_order": 120,
            "plan_type": "paid",
            "product_kind": "vsayte",
            "voice_minutes_monthly": 0,
            "trial_days": 0,
        },
    )


def unseed_vsayte_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    SubscriptionPlan.objects.filter(slug__in=["vsayte-free", "vsayte-hosting", "vsayte-pro"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0005_voice_minute_plans"),
    ]

    operations = [
        migrations.AlterField(
            model_name="subscriptionplan",
            name="product_kind",
            field=models.CharField(
                choices=[
                    ("platform", "Платформа"),
                    ("voice", "Голосовой ассистент"),
                    ("vsayte", "Всайте"),
                ],
                db_index=True,
                default="platform",
                help_text="platform — кабинет/сотрудники; voice — минуты SpeechKit; vsayte — конструктор сайтов.",
                max_length=16,
            ),
        ),
        migrations.RunPython(seed_vsayte_plans, unseed_vsayte_plans),
    ]
