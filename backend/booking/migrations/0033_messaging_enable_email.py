from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0032_slot_booking_location"),
    ]

    operations = [
        migrations.AddField(
            model_name="providermessagingsettings",
            name="enable_email",
            field=models.BooleanField(
                default=True,
                help_text="Письма клиентам о записи (если указан email).",
            ),
        ),
    ]
