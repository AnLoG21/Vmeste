from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0007_order_size_bonus_spent"),
        ("reviews", "0006_review_cafe_order"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="shop_order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reviews",
                to="shop.shoporder",
            ),
        ),
    ]
