from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0014_availabilityslot_service_ids"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="selected_options",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Снимок выбранных допов: [{id,name,price,extra_minutes}, …]",
            ),
        ),
    ]
