from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0012_user_consent_versions_and_provider_license"),
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
                ],
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="organization_slug",
            field=models.SlugField(
                blank=True,
                help_text="Публичный URL /o/<slug>/",
                max_length=80,
                null=True,
                unique=True,
            ),
        ),
    ]
