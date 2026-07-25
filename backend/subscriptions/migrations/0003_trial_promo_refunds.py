from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def update_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    starter_features = [
        "7 дней полного доступа",
        "Онлайн-запись и каталог услуг",
        "Чаты, карта, календарь интервалов",
        "Активируется один раз — потом пропадает",
    ]
    business_features = [
        "Онлайн-запись клиентов",
        "Каталог услуг и категорий",
        "Чаты с клиентами и командой",
        "Управление сотрудниками",
        "Календарь интервалов",
        "Отзывы и рейтинг",
        "Карта и поиск организаций",
    ]
    enterprise_features = [
        "Индивидуальная разработка под ваш бизнес",
        "Интеграции с вашими системами",
        "Обучение команды",
        "Персональный менеджер",
    ]

    SubscriptionPlan.objects.update_or_create(
        slug="starter",
        defaults={
            "name": "Старт",
            "description": "Бесплатная неделя полного доступа. Активируется только один раз — после этого тариф пропадает.",
            "price_monthly": "0.00",
            "features": starter_features,
            "is_active": True,
            "sort_order": 1,
            "plan_type": "trial",
            "trial_days": 7,
        },
    )
    SubscriptionPlan.objects.update_or_create(
        slug="business",
        defaults={
            "name": "Бизнес",
            "description": "Полный функционал платформы для вашей организации.",
            "price_monthly": "990.00",
            "features": business_features,
            "is_active": True,
            "sort_order": 2,
            "plan_type": "paid",
            "trial_days": 0,
        },
    )
    SubscriptionPlan.objects.update_or_create(
        slug="enterprise",
        defaults={
            "name": "Индивидуальная автоматизация",
            "description": "Персональная настройка платформы под процессы вашего бизнеса.",
            "price_monthly": "0.00",
            "features": enterprise_features,
            "is_active": True,
            "sort_order": 3,
            "plan_type": "custom",
            "trial_days": 0,
        },
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0002_usersubscription_cancel_at_period_end"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="plan_type",
            field=models.CharField(
                choices=[("trial", "Пробный период"), ("paid", "Платный"), ("custom", "Индивидуальный")],
                default="paid",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="subscriptionplan",
            name="trial_days",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Длительность пробного периода в днях (для plan_type=trial).",
            ),
        ),
        migrations.AddField(
            model_name="usersubscription",
            name="source",
            field=models.CharField(
                choices=[("paid", "Оплата"), ("trial", "Пробный период"), ("promo", "Промокод")],
                default="paid",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="usersubscription",
            name="promo_code",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="usersubscription",
            name="reminder_3d_sent",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="usersubscription",
            name="reminder_1d_sent",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="usersubscription",
            name="refunded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="yookassa_refund_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="payment",
            name="refunded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="payment",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Ожидает"),
                    ("succeeded", "Успешно"),
                    ("cancelled", "Отменён"),
                    ("refunded", "Возврат"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="PromoRedemption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(db_index=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "subscription",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="promo_redemptions",
                        to="subscriptions.usersubscription",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="promo_redemptions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="promoredemption",
            constraint=models.UniqueConstraint(fields=("user", "code"), name="uniq_user_promo_code"),
        ),
        migrations.RunPython(update_plans, noop_reverse),
    ]
