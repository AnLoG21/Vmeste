from decimal import Decimal

from django.db import migrations, models


def seed_voice_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    # Mark existing plans as platform (field default already platform).
    SubscriptionPlan.objects.filter(product_kind="").update(product_kind="platform")

    plans = [
        {
            "slug": "voice-30",
            "name": "Голос · 30 мин",
            "description": "Минуты распознавания и синтеза речи для голосового администратора. Покупка, продление и смена тарифа — в любой момент.",
            "price_monthly": Decimal("390.00"),
            "features": [
                "30 минут SpeechKit в месяц",
                "Входящие и исходящие сценарии ассистента",
                "Можно сменить на больший тариф в любой момент",
            ],
            "sort_order": 10,
            "voice_minutes_monthly": 30,
        },
        {
            "slug": "voice-100",
            "name": "Голос · 100 мин",
            "description": "Оптимально для салона с регулярными звонками клиентов.",
            "price_monthly": Decimal("990.00"),
            "features": [
                "100 минут SpeechKit в месяц",
                "Сброс лимита при продлении",
                "Смена тарифа без потери доступа к ассистенту",
            ],
            "sort_order": 11,
            "voice_minutes_monthly": 100,
        },
        {
            "slug": "voice-300",
            "name": "Голос · 300 мин",
            "description": "Для активных точек и сервисных центров с большим потоком звонков.",
            "price_monthly": Decimal("2490.00"),
            "features": [
                "300 минут SpeechKit в месяц",
                "Приоритет при нагрузке на голос",
                "Продление и смена тарифа в кабинете",
            ],
            "sort_order": 12,
            "voice_minutes_monthly": 300,
        },
    ]
    for row in plans:
        SubscriptionPlan.objects.update_or_create(
            slug=row["slug"],
            defaults={
                "name": row["name"],
                "description": row["description"],
                "price_monthly": row["price_monthly"],
                "features": row["features"],
                "is_active": True,
                "sort_order": row["sort_order"],
                "plan_type": "paid",
                "product_kind": "voice",
                "voice_minutes_monthly": row["voice_minutes_monthly"],
                "trial_days": 0,
            },
        )


def unseed_voice_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    SubscriptionPlan.objects.filter(slug__in=["voice-30", "voice-100", "voice-300"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0004_free_plan_no_trial"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="product_kind",
            field=models.CharField(
                choices=[("platform", "Платформа"), ("voice", "Голосовой ассистент")],
                db_index=True,
                default="platform",
                help_text="platform — кабинет/сотрудники; voice — минуты SpeechKit для голосового ассистента.",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="voice_minutes_monthly",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Минут SpeechKit в месяц для product_kind=voice (0 = не голосовой тариф).",
            ),
        ),
        migrations.RunPython(seed_voice_plans, unseed_voice_plans),
    ]
