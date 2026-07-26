# Generated manually for ServicePhoto

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0004_template_slug"),
    ]

    operations = [
        migrations.CreateModel(
            name="ServicePhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="service_photos/%Y/%m/")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "service",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="catalog.service",
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
    ]
