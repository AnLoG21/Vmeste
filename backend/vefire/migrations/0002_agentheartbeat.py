from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("vefire", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AgentHeartbeat",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("remote_url", models.URLField(max_length=500)),
                ("ips", models.JSONField(blank=True, default=list)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vefire_agent",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
