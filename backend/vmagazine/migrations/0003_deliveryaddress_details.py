# intercom + extra on DeliveryAddress

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("vmagazine", "0002_ozon_like_features"),
    ]

    operations = [
        migrations.AddField(
            model_name="deliveryaddress",
            name="intercom",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="deliveryaddress",
            name="extra",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
