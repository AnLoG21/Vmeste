from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0011_delivery_courier_client"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafeorder",
            name="delivery_apartment",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="delivery_entrance",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="delivery_intercom",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="delivery_private_house",
            field=models.BooleanField(default=False),
        ),
    ]
