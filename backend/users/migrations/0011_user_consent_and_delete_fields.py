from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0010_user_anonymous_seat_count"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="consent_privacy_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="consent_offer_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="age_confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="account_deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
