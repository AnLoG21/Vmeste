from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0006_product_sizes_related"),
    ]

    operations = [
        migrations.AddField(
            model_name="shoporder",
            name="bonus_spent",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="shoporderitem",
            name="selected_size",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
