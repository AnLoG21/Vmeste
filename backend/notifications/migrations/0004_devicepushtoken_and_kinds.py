from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0003_inappnotification"),
        migrations.swappable_dependency("users.User"),
    ]

    operations = [
        migrations.CreateModel(
            name="DevicePushToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(max_length=512, unique=True)),
                (
                    "platform",
                    models.CharField(
                        choices=[("android", "Android"), ("ios", "iOS"), ("web", "Web")],
                        default="android",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="push_tokens",
                        to="users.user",
                    ),
                ),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.AlterField(
            model_name="inappnotification",
            name="kind",
            field=models.CharField(
                choices=[
                    ("staff_invite_accepted", "Сотрудник принял приглашение"),
                    ("chat_message", "Сообщение в чате"),
                    ("booking", "Запись"),
                    ("review", "Отзыв"),
                ],
                max_length=40,
            ),
        ),
    ]
