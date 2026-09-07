# Generated manually for multi delivery methods + ETA

from django.db import migrations, models


def forwards_seed_flags(apps, schema_editor):
    ShopSettings = apps.get_model("shop", "ShopSettings")
    for row in ShopSettings.objects.all():
        kind = (row.delivery_provider or "own").strip()
        row.enable_own_courier = kind == "own" or kind == ""
        row.enable_yandex_delivery = kind == "yandex"
        row.enable_cdek_delivery = kind == "cdek"
        # если доставка выключена — флаги не трогаем сильно, own остаётся дефолтом
        if not row.enable_delivery:
            row.enable_own_courier = True
            row.enable_yandex_delivery = False
            row.enable_cdek_delivery = False
        row.save(
            update_fields=[
                "enable_own_courier",
                "enable_yandex_delivery",
                "enable_cdek_delivery",
            ]
        )


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0002_category_parent_pool"),
    ]

    operations = [
        migrations.AddField(
            model_name="shopsettings",
            name="enable_own_courier",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="enable_yandex_delivery",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="enable_cdek_delivery",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="own_eta_text",
            field=models.CharField(blank=True, default="1–3 часа", max_length=80),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="yandex_eta_text",
            field=models.CharField(blank=True, default="от 40 минут", max_length=80),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="cdek_eta_text",
            field=models.CharField(blank=True, default="1–5 дней", max_length=80),
        ),
        migrations.AddField(
            model_name="shoporder",
            name="chosen_delivery_provider",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Способ доставки, выбранный покупателем: own|yandex|cdek",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="shoporder",
            name="eta_text",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.RunPython(forwards_seed_flags, backwards_noop),
    ]
