from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0007_order_size_bonus_spent"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="weight_grams",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Вес единицы товара в граммах (для доставки). Пусто = 300 г.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="length_mm",
            field=models.PositiveIntegerField(blank=True, help_text="Длина, мм", null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="width_mm",
            field=models.PositiveIntegerField(blank=True, help_text="Ширина, мм", null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="height_mm",
            field=models.PositiveIntegerField(blank=True, help_text="Высота, мм", null=True),
        ),
    ]
