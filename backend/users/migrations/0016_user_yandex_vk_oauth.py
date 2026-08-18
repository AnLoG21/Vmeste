from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0015_user_notify_prefs"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="yandex_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="user",
            name="vk_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
    ]
