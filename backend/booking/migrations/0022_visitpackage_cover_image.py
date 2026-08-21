from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0021_salon_winback_loyalty_packages"),
    ]

    operations = [
        migrations.AddField(
            model_name="visitpackage",
            name="cover_image",
            field=models.ImageField(
                blank=True,
                help_text="Обложка абонемента для карточки организации.",
                null=True,
                upload_to="visit_packages/%Y/%m/",
            ),
        ),
    ]
