import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0012_delivery_entrance_details"),
        ("reviews", "0005_review_staff_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="cafe_order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reviews",
                to="cafe.cafeorder",
            ),
        ),
    ]
