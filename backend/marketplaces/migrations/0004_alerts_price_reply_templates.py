from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("marketplaces", "0003_webhook_and_sync"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplacesettings",
            name="low_stock_threshold",
            field=models.PositiveIntegerField(default=5, help_text="Порог алерта «низкий остаток» (шт.)."),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="price_protect_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Защита цены: мин. цена и отключение автоскидок при выгрузке цен.",
            ),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="price_min_floor_percent",
            field=models.PositiveIntegerField(
                default=10,
                help_text="Мин. цена = цена × (100 − N)% / 100. Например 10 → не ниже 90% от цены.",
            ),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="ozon_disable_auto_actions",
            field=models.BooleanField(
                default=True,
                help_text="При защите цены отправлять auto_action_enabled=DISABLED на Ozon.",
            ),
        ),
        migrations.CreateModel(
            name="MarketplaceReplyTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                (
                    "marketplace",
                    models.CharField(
                        choices=[("ozon", "Ozon"), ("wildberries", "Wildberries"), ("any", "Любая")],
                        max_length=20,
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[("review", "Отзыв"), ("question", "Вопрос")],
                        default="review",
                        max_length=16,
                    ),
                ),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marketplace_reply_templates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
    ]
