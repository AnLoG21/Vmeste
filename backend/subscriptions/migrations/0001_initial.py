import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def seed_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    plans = [
        {
            "slug": "starter",
            "name": "Старт",
            "description": "Для небольшого бизнеса: онлайн-запись, каталог услуг и чат с клиентами.",
            "price_monthly": "990.00",
            "features": [
                "Онлайн-запись клиентов",
                "Каталог услуг и категорий",
                "Чат с клиентами",
                "Карта и поиск организаций",
            ],
            "sort_order": 1,
        },
        {
            "slug": "business",
            "name": "Бизнес",
            "description": "Расширенные возможности для растущей организации с несколькими сотрудниками.",
            "price_monthly": "2990.00",
            "features": [
                "Всё из тарифа «Старт»",
                "Управление сотрудниками",
                "Календарь интервалов",
                "Отзывы и рейтинг",
                "Приоритетная поддержка",
            ],
            "sort_order": 2,
        },
        {
            "slug": "enterprise",
            "name": "Индивидуальная автоматизация",
            "description": "Персональная настройка платформы под процессы вашего бизнеса.",
            "price_monthly": "0.00",
            "features": [
                "Индивидуальная разработка под ваш бизнес",
                "Интеграции с вашими системами",
                "Обучение команды",
                "Персональный менеджер",
            ],
            "sort_order": 3,
        },
    ]
    for p in plans:
        SubscriptionPlan.objects.update_or_create(slug=p["slug"], defaults=p)


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SubscriptionPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(unique=True)),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("price_monthly", models.DecimalField(decimal_places=2, max_digits=10)),
                ("features", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["sort_order", "price_monthly"]},
        ),
        migrations.CreateModel(
            name="UserSubscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(
                    choices=[
                        ("pending", "Ожидает оплаты"),
                        ("active", "Активна"),
                        ("expired", "Истекла"),
                        ("cancelled", "Отменена"),
                    ],
                    default="pending",
                    max_length=20,
                )),
                ("period_start", models.DateTimeField(blank=True, null=True)),
                ("period_end", models.DateTimeField(blank=True, null=True)),
                ("auto_renew", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("plan", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="subscriptions",
                    to="subscriptions.subscriptionplan",
                )),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="subscriptions",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("yookassa_payment_id", models.CharField(blank=True, db_index=True, max_length=64)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("status", models.CharField(
                    choices=[
                        ("pending", "Ожидает"),
                        ("succeeded", "Успешно"),
                        ("cancelled", "Отменён"),
                    ],
                    default="pending",
                    max_length=20,
                )),
                ("confirmation_url", models.URLField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("plan", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="payments",
                    to="subscriptions.subscriptionplan",
                )),
                ("subscription", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="payments",
                    to="subscriptions.usersubscription",
                )),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="payments",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.RunPython(seed_plans, migrations.RunPython.noop),
    ]
