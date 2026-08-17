from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0019_messaging_telegram_org_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="providermessagingsettings",
            name="new_booking_template",
            field=models.TextField(blank=True, default=""),
        ),
    ]
