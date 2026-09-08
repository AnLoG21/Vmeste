from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0028_provider_client_card"),
    ]

    operations = [
        migrations.AddField(
            model_name="loyaltysettings",
            name="client_memory_fields",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
