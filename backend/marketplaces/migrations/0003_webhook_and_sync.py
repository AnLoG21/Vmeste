from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplaces", "0002_yandex_disk_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplacesettings",
            name="webhook_secret",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Секрет для входящего webhook синхронизации.",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="last_sync_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
