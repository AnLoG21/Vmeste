from django.db import migrations, models


def convert_to_free(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    UserSubscription = apps.get_model("subscriptions", "UserSubscription")
    free_features = [
        "Онлайн-запись клиентов без ограничения по сроку",
        "Каталог услуг и категорий",
        "Чаты, карта, календарь интервалов",
        "Отзывы и карточка организации",
    ]
    business_features = [
        "Всё из бесплатного тарифа",
        "Сотрудники: приглашения, роли и права",
        "Приоритетная поддержка",
        "Аналитика организации",
    ]
    SubscriptionPlan.objects.update_or_create(
        slug="starter",
        defaults={
            "name": "Бесплатный",
            "description": "Записи, каталог и чаты — без срока и без карты. Сотрудники и приоритетная поддержка — в тарифе Бизнес.",
            "price_monthly": "0.00",
            "features": free_features,
            "is_active": True,
            "sort_order": 1,
            "plan_type": "free",
            "trial_days": 0,
        },
    )
    SubscriptionPlan.objects.update_or_create(
        slug="business",
        defaults={
            "name": "Бизнес",
            "description": "Сотрудники, приоритетная поддержка и расширенные инструменты для команды.",
            "price_monthly": "990.00",
            "features": business_features,
            "is_active": True,
            "sort_order": 2,
            "plan_type": "paid",
            "trial_days": 0,
        },
    )
    UserSubscription.objects.filter(plan__slug="starter", status="active").update(period_end=None)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0003_trial_promo_refunds"),
    ]

    operations = [
        migrations.AlterField(
            model_name="subscriptionplan",
            name="plan_type",
            field=models.CharField(
                choices=[
                    ("free", "Бесплатный"),
                    ("trial", "Пробный период"),
                    ("paid", "Платный"),
                    ("custom", "Индивидуальный"),
                ],
                default="paid",
                max_length=16,
            ),
        ),
        migrations.RunPython(convert_to_free, noop),
    ]
