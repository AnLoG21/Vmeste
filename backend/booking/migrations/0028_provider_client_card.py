from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0027_clientpackage_reminder_1d"),
        ("users", "0021_user_shops_sphere"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProviderClientCard",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tech", models.JSONField(blank=True, default=dict)),
                ("personal", models.JSONField(blank=True, default=dict)),
                ("technical_notes", models.TextField(blank=True, default="")),
                ("preferences_notes", models.TextField(blank=True, default="")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "client",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="provider_memory_cards",
                        to="users.user",
                    ),
                ),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="client_memory_cards",
                        to="users.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="providerclientcard",
            constraint=models.UniqueConstraint(fields=("provider", "client"), name="uniq_provider_client_memory"),
        ),
    ]
