from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("marketplaces", "0006_analytics_spp_costs"),
    ]

    operations = [
        migrations.CreateModel(
            name="MarketplaceCardDesign",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                (
                    "layout",
                    models.CharField(
                        choices=[
                            ("hero", "Главный кадр"),
                            ("benefits", "Преимущества"),
                            ("specs", "Характеристики"),
                        ],
                        default="hero",
                        max_length=32,
                    ),
                ),
                ("style", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marketplace_card_designs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-updated_at", "-id"]},
        ),
    ]
