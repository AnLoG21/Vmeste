from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0004_order_email_tips"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafesettings",
            name="payout_account",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="payout_bank_name",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="payout_bik",
            field=models.CharField(blank=True, default="", max_length=9),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="payout_corr_account",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="payout_inn",
            field=models.CharField(blank=True, default="", max_length=12),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="payout_legal_name",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="yookassa_secret_key",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="yookassa_shop_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="include_service_charge",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="provider_payout_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Сумма к выплате организации (без сервисного сбора).",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="service_charge_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="tip_custom",
            field=models.BooleanField(default=False, help_text="Чаевые заданы суммой, а не процентом."),
        ),
        migrations.AddField(
            model_name="cafeorderitem",
            name="removed_ingredients",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.CreateModel(
            name="CafeMenuItemRemovableIngredient",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="removable_ingredients",
                        to="cafe.cafemenuitem",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="CafeOrderItemRating",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "rating",
                    models.PositiveSmallIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(5),
                        ]
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "menu_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="order_ratings",
                        to="cafe.cafemenuitem",
                    ),
                ),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="item_ratings",
                        to="cafe.cafeorder",
                    ),
                ),
            ],
            options={
                "unique_together": {("order", "menu_item")},
            },
        ),
    ]
