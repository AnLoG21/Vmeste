from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplaces", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplacesettings",
            name="yandex_disk_token",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
    ]
