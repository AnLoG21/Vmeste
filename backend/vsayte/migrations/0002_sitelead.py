from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("vsayte", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SiteLead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(blank=True, default="", max_length=200)),
                ("contact", models.CharField(blank=True, default="", max_length=200)),
                ("message", models.TextField(blank=True, default="")),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("page_url", models.CharField(blank=True, default="", max_length=500)),
                ("user_agent", models.CharField(blank=True, default="", max_length=400)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("is_read", models.BooleanField(db_index=True, default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "site",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="leads",
                        to="vsayte.site",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
