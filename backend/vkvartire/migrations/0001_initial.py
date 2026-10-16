import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Listing",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "deal_type",
                    models.CharField(
                        choices=[("rent", "Аренда"), ("sale", "Продажа")],
                        db_index=True,
                        max_length=8,
                    ),
                ),
                (
                    "rooms",
                    models.PositiveSmallIntegerField(
                        db_index=True,
                        default=1,
                        help_text="0 = студия, 1–4 = комнаты, 5+ = 5 и более",
                    ),
                ),
                ("price", models.PositiveIntegerField(db_index=True)),
                ("currency", models.CharField(default="RUB", max_length=3)),
                ("area_m2", models.DecimalField(blank=True, decimal_places=1, max_digits=8, null=True)),
                ("floor", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("floors_total", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("address", models.CharField(blank=True, default="", max_length=512)),
                ("lat", models.FloatField(blank=True, db_index=True, null=True)),
                ("lon", models.FloatField(blank=True, db_index=True, null=True)),
                ("metro_name", models.CharField(blank=True, default="", max_length=128)),
                ("metro_walk_min", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("manual", "Вручную"),
                            ("avito", "Avito"),
                            ("cian", "Циан"),
                            ("other", "Другое"),
                        ],
                        db_index=True,
                        default="manual",
                        max_length=16,
                    ),
                ),
                ("external_id", models.CharField(blank=True, default="", max_length=128)),
                ("external_url", models.URLField(blank=True, default="", max_length=1024)),
                ("fingerprint", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("is_agent", models.BooleanField(default=False, help_text="Объявление от посредника")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-updated_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="ListingPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(blank=True, null=True, upload_to="vkvartire/photos/")),
                ("url", models.URLField(blank=True, default="", max_length=1024)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "listing",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="vkvartire.listing",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="Favorite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "listing",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="favorites",
                        to="vkvartire.listing",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vkvartire_favorites",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="listing",
            index=models.Index(fields=["deal_type", "price", "rooms"], name="vkvartire_l_deal_ty_7c0a1d_idx"),
        ),
        migrations.AddIndex(
            model_name="listing",
            index=models.Index(fields=["is_active", "deal_type"], name="vkvartire_l_is_acti_2e8f4b_idx"),
        ),
        migrations.AddConstraint(
            model_name="listing",
            constraint=models.UniqueConstraint(
                condition=~models.Q(external_id=""),
                fields=("source", "external_id"),
                name="uniq_vkvartire_source_external_id",
            ),
        ),
        migrations.AddConstraint(
            model_name="favorite",
            constraint=models.UniqueConstraint(fields=("user", "listing"), name="uniq_vkvartire_favorite"),
        ),
    ]
