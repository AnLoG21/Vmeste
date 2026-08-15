import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("booking", "0016_booking_prepay_and_acquiring"),
    ]

    operations = [
        migrations.CreateModel(
            name="InspectionReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("vehicle_title", models.CharField(blank=True, default="", max_length=200)),
                ("vehicle_plate", models.CharField(blank=True, default="", max_length=32)),
                ("vehicle_vin", models.CharField(blank=True, default="", max_length=64)),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Черновик"),
                            ("sent", "Отправлен клиенту"),
                            ("approved", "Утверждён"),
                            ("cancelled", "Отменён"),
                        ],
                        db_index=True,
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("share_token", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("parts_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("labor_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("grand_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "booking",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inspection_reports",
                        to="booking.booking",
                    ),
                ),
                (
                    "client",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="client_inspection_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_inspection_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="inspection_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="InspectionItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "severity",
                    models.CharField(
                        choices=[
                            ("critical", "Критично"),
                            ("recommended", "Рекомендуется"),
                            ("ok", "В порядке"),
                        ],
                        default="recommended",
                        max_length=20,
                    ),
                ),
                ("parts_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("labor_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("client_selected", models.BooleanField(default=False)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "report",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="inspections.inspectionreport",
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="InspectionItemMedia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="inspection_photos/%Y/%m/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="inspections.inspectionitem",
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
    ]
