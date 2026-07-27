from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0011_user_consent_and_delete_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="consent_privacy_version",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="user",
            name="consent_offer_version",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="user",
            name="consent_ip",
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="consent_user_agent",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
        migrations.AddField(
            model_name="user",
            name="provider_authority_confirmed_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Подтверждение права оказывать услуги / лицензии (если требуется).",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="provider_license_number",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Номер лицензии организации (необязательно).",
                max_length=120,
            ),
        ),
    ]
