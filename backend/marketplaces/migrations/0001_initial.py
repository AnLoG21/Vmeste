from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("users", "0017_user_marketplaces_sphere"),
    ]

    operations = [
        migrations.CreateModel(
            name="MarketplaceSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("environment", models.CharField(choices=[("sandbox", "Песочница"), ("prod", "Боевой")], default="sandbox", max_length=16)),
                ("ozon_client_id", models.CharField(blank=True, default="", max_length=128)),
                ("ozon_api_key", models.CharField(blank=True, default="", max_length=256)),
                ("wb_api_key", models.CharField(blank=True, default="", max_length=512)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marketplace_settings",
                        to="users.user",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="MarketplaceProductHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("marketplace", models.CharField(choices=[("ozon", "Ozon"), ("wildberries", "Wildberries")], max_length=20)),
                ("offer_id", models.CharField(db_index=True, max_length=128)),
                ("product_data", models.JSONField(default=dict)),
                ("status", models.CharField(default="pending", max_length=32)),
                ("response", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marketplace_products",
                        to="users.user",
                    ),
                ),
            ],
            options={"ordering": ["-updated_at", "-id"]},
        ),
        migrations.CreateModel(
            name="MarketplaceTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True, default="")),
                ("marketplace", models.CharField(choices=[("ozon", "Ozon"), ("wildberries", "Wildberries")], max_length=20)),
                ("brand", models.CharField(blank=True, default="", max_length=180)),
                ("description_text", models.TextField(blank=True, default="")),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("stock", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marketplace_templates",
                        to="users.user",
                    ),
                ),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="MarketplaceApiLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("marketplace", models.CharField(blank=True, default="", max_length=20)),
                ("endpoint", models.CharField(max_length=255)),
                ("method", models.CharField(max_length=8)),
                ("status_code", models.IntegerField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "provider",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="marketplace_api_logs",
                        to="users.user",
                    ),
                ),
            ],
            options={"ordering": ["-id"]},
        ),
        migrations.AddIndex(
            model_name="marketplaceproducthistory",
            index=models.Index(fields=["provider", "marketplace", "offer_id"], name="marketplace_provide_idx"),
        ),
    ]
