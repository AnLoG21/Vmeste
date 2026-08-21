from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cafe", "0009_delivery_zones"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafetable",
            name="waiter_called_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Гость вызвал официанта — показывается на карте зала.",
                null=True,
            ),
        ),
    ]
