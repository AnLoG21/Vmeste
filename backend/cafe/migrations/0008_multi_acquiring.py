from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cafe", "0007_cafe_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafesettings",
            name="payment_provider",
            field=models.CharField(
                choices=[
                    ("yookassa", "ЮKassa"),
                    ("tbank", "Т‑Банк"),
                    ("cloudpayments", "CloudPayments"),
                    ("robokassa", "Robokassa"),
                ],
                default="yookassa",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="tbank_terminal_key",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="tbank_password",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="cloudpayments_public_id",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="cloudpayments_api_secret",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="robokassa_merchant_login",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="robokassa_password1",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="cafesettings",
            name="robokassa_password2",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
    ]
