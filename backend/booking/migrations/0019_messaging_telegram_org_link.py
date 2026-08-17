from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0018_messaging_and_reminders"),
    ]

    operations = [
        migrations.AddField(
            model_name="providermessagingsettings",
            name="telegram_org_link_token",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]
