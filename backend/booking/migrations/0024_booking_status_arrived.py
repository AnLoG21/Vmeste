# Generated manually for Booking.Status.arrived

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0023_booking_client_package"),
    ]

    operations = [
        migrations.AlterField(
            model_name="booking",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "New"),
                    ("confirmed", "Confirmed"),
                    ("arrived", "Клиент пришёл"),
                    ("cancelled", "Cancelled"),
                    ("done", "Done"),
                ],
                default="new",
                max_length=20,
            ),
        ),
    ]
