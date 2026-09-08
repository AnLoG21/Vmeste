from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0005_subscription_kind"),
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
                    ("inspection", "Приёмка / согласование"),
                    ("vmenu", "Вменю"),
                    ("shop_order", "Заказ магазина"),
                    ("loyalty_package", "Абонемент"),
                ],
                max_length=40,
            ),
        ),
    ]
