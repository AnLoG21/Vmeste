from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0016_user_yandex_vk_oauth"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="provider_sphere",
            field=models.CharField(
                blank=True,
                choices=[
                    ("hair_salon", "Салон красоты"),
                    ("service_center", "Сервисный центр"),
                    ("cafe_restaurant", "Кафе и рестораны"),
                    ("marketplaces", "Маркетплейсы"),
                ],
                max_length=30,
            ),
        ),
    ]
