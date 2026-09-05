# Generated manually for P3 onboarding

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0019_user_map_hidden"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="platform_tour_completed",
            field=models.BooleanField(
                default=False,
                help_text="Онбординг: пользователь завершил или пропустил тур по кабинету.",
            ),
        ),
    ]
