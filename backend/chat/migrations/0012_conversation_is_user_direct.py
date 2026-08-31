from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0011_message_attachment_kinds"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="is_user_direct",
            field=models.BooleanField(
                default=False,
                help_text="Личная переписка между пользователями (Вменю и др.).",
            ),
        ),
    ]
