from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("booking", "0015_booking_selected_options"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("none", "Без оплаты"),
                    ("pending", "Ожидает оплату"),
                    ("paid", "Оплачено"),
                    ("expired", "Оплата не прошла"),
                ],
                db_index=True,
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="payment_url",
            field=models.URLField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="booking",
            name="prepay_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="booking",
            name="yookassa_payment_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.CreateModel(
            name="ProviderAcquiring",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("yookassa_shop_id", models.CharField(blank=True, default="", max_length=64)),
                ("yookassa_secret_key", models.CharField(blank=True, default="", max_length=128)),
                (
                    "prepay_mode",
                    models.CharField(
                        choices=[
                            ("off", "Выключена"),
                            ("percent", "Частичная"),
                            ("full", "Полная"),
                        ],
                        default="off",
                        max_length=16,
                    ),
                ),
                (
                    "prepay_percent",
                    models.PositiveSmallIntegerField(
                        default=50,
                        help_text="Процент предоплаты при режиме «частичная» (1–100).",
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="acquiring",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
