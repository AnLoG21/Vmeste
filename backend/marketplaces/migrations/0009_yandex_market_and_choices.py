from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplaces", "0008_card_design_canvas"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplacesettings",
            name="yandex_market_api_key",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Api-Key токен кабинета продавца Яндекс Маркета.",
                max_length=512,
            ),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="yandex_market_campaign_id",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Campaign ID магазина в Partner API Яндекс Маркета.",
                max_length=64,
            ),
        ),
        migrations.AlterField(
            model_name="marketplaceproducthistory",
            name="marketplace",
            field=models.CharField(
                choices=[("ozon", "Ozon"), ("wildberries", "Wildberries"), ("yandex", "Яндекс Маркет")],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="marketplacetemplate",
            name="marketplace",
            field=models.CharField(
                choices=[("ozon", "Ozon"), ("wildberries", "Wildberries"), ("yandex", "Яндекс Маркет")],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="marketplacereplytemplate",
            name="marketplace",
            field=models.CharField(
                choices=[
                    ("ozon", "Ozon"),
                    ("wildberries", "Wildberries"),
                    ("yandex", "Яндекс Маркет"),
                    ("any", "Любая"),
                ],
                max_length=20,
            ),
        ),
    ]
