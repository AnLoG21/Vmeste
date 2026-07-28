from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0003_shapes_availability_guest_provider"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafeorder",
            name="guest_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="tip_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="tip_percent",
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
