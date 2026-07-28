from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0005_servicephoto"),
    ]

    operations = [
        migrations.CreateModel(
            name="ServiceOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150)),
                ("price", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=10)),
                ("extra_minutes", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("template_slug", models.CharField(blank=True, db_index=True, default="", max_length=80)),
                (
                    "service",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="options",
                        to="catalog.service",
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.AddConstraint(
            model_name="serviceoption",
            constraint=models.UniqueConstraint(
                condition=models.Q(("template_slug__gt", "")),
                fields=("service", "template_slug"),
                name="uniq_service_option_template_slug",
            ),
        ),
    ]
