from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0005_product_authenticity_views_bonuses"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="sizes",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Доступные размеры: ["S", "M", …]',
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="related_products",
            field=models.ManyToManyField(
                blank=True,
                related_name="related_from",
                to="shop.product",
            ),
        ),
    ]
