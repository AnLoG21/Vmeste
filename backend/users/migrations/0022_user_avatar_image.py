from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0021_user_shops_sphere"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_image",
            field=models.ImageField(
                blank=True,
                help_text="Аватар пользователя (чаты, база клиентов, профиль).",
                null=True,
                upload_to="user_avatars/%Y/%m/",
            ),
        ),
    ]
