from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0004_devicepushtoken_and_kinds"),
    ]

    operations = [
        migrations.AlterField(
            model_name="inappnotification",
            name="kind",
            field=models.CharField(
                choices=[
                    ("staff_invite_accepted", "Сотрудник принял приглашение"),
                    ("chat_message", "Сообщение в чате"),
                    ("booking", "Запись"),
                    ("review", "Отзыв"),
                    ("subscription", "Подписка"),
                ],
                max_length=40,
            ),
        ),
    ]
