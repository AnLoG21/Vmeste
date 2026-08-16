from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0017_multi_acquiring_and_calendar"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="reminder_24h_sent",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="booking",
            name="reminder_2h_sent",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="ProviderMessagingSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("remind_clients", models.BooleanField(default=True)),
                ("remind_org", models.BooleanField(default=True)),
                ("notify_org_on_new", models.BooleanField(default=True)),
                ("enable_telegram", models.BooleanField(default=False)),
                ("enable_max", models.BooleanField(default=False)),
                ("enable_whatsapp", models.BooleanField(default=False)),
                ("enable_sms", models.BooleanField(default=False)),
                ("telegram_bot_token", models.CharField(blank=True, default="", max_length=128)),
                ("telegram_notify_chat_id", models.CharField(blank=True, default="", max_length=64)),
                ("max_bot_token", models.CharField(blank=True, default="", max_length=128)),
                ("max_notify_chat_id", models.CharField(blank=True, default="", max_length=64)),
                (
                    "wa_api_url",
                    models.CharField(blank=True, default="https://api.green-api.com", max_length=255),
                ),
                ("wa_id_instance", models.CharField(blank=True, default="", max_length=64)),
                ("wa_api_token", models.CharField(blank=True, default="", max_length=128)),
                ("sms_api_id", models.CharField(blank=True, default="", max_length=128)),
                ("reminder_template", models.TextField(blank=True, default="")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.OneToOneField(
                        on_delete=models.CASCADE,
                        related_name="messaging_settings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
