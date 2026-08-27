from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    dependencies = [
        ("marketplaces", "0005_notify_and_seen_orders"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplacesettings",
            name="sku_costs",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="spp_rules",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="spp_reprice_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Умная защита цены с учётом СПП WB (полуавто).",
            ),
        ),
        migrations.CreateModel(
            name="MarketplaceRepriceLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("marketplace", models.CharField(default="wildberries", max_length=20)),
                ("offer_id", models.CharField(blank=True, default="", max_length=128)),
                ("nm_id", models.CharField(blank=True, default="", max_length=64)),
                ("old_price", models.PositiveIntegerField(default=0)),
                ("new_price", models.PositiveIntegerField(default=0)),
                ("spp_percent", models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ("reason", models.CharField(blank=True, default="", max_length=400)),
                ("applied", models.BooleanField(default=False)),
                ("sandbox", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marketplace_reprice_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-id"]},
        ),
    ]
