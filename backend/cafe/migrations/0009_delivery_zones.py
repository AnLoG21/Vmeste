from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cafe", "0008_multi_acquiring"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafesettings",
            name="delivery_zones",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Зоны доставки: [{id,name,color,fee,min_order,polygon:[[lat,lon],…]}]",
            ),
        ),
    ]
