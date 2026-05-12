from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("locations", "0003_alter_providerlocation_provider_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="providerlocation",
            name="entrance",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="providerlocation",
            name="floor",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="providerlocation",
            name="apartment",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="providerlocation",
            name="intercom",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="providerlocation",
            name="address_details",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
