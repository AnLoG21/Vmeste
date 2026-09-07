# Generated manually: shops sphere

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0020_user_platform_tour_completed"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="provider_sphere",
            field=models.CharField(
                blank=True,
                choices=[
                    ("hair_salon", "Салон красоты"),
                    ("service_center", "Автосервис"),
                    ("cafe_restaurant", "Кафе и рестораны"),
                    ("marketplaces", "Маркетплейсы"),
                    ("shops", "Магазины"),
                ],
                max_length=30,
            ),
        ),
    ]
