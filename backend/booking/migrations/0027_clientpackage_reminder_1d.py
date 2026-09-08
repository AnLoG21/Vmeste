from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0026_booking_loyalty_discount"),
    ]

    operations = [
        migrations.AddField(
            model_name="clientpackage",
            name="reminder_1d_sent",
            field=models.BooleanField(default=False),
        ),
    ]
