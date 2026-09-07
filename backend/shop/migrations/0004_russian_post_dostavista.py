# Generated manually: Почта России + Dostavista

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0003_multi_delivery_methods"),
    ]

    operations = [
        migrations.AddField(
            model_name="shopsettings",
            name="enable_russian_post",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="enable_dostavista",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="russian_post_eta_text",
            field=models.CharField(blank=True, default="3–10 дней", max_length=80),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="dostavista_eta_text",
            field=models.CharField(blank=True, default="1–3 часа", max_length=80),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="russian_post_token",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="russian_post_user_key",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Ключ X-User-Authorization (Basic …) из ЛК Отправка",
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="dostavista_token",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
