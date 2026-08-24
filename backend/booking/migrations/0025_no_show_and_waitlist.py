# no-show status + waitlist

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0024_booking_status_arrived"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("catalog", "0006_serviceoption"),
    ]

    operations = [
        migrations.AlterField(
            model_name="booking",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "New"),
                    ("confirmed", "Confirmed"),
                    ("arrived", "Клиент пришёл"),
                    ("no_show", "Не пришёл"),
                    ("cancelled", "Cancelled"),
                    ("done", "Done"),
                ],
                default="new",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="WaitlistEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("preferred_date", models.DateField(blank=True, null=True)),
                ("comment", models.CharField(blank=True, default="", max_length=250)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("waiting", "Ждёт"),
                            ("notified", "Уведомлён"),
                            ("booked", "Записался"),
                            ("cancelled", "Отменён"),
                        ],
                        db_index=True,
                        default="waiting",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("notified_at", models.DateTimeField(blank=True, null=True)),
                (
                    "client",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="client_waitlist",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="waitlist_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "service",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="waitlist_entries",
                        to="catalog.service",
                    ),
                ),
                (
                    "staff",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="staff_waitlist",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["created_at"]},
        ),
    ]
