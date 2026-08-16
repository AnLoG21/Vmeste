from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0014_user_is_demo"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="notify_booking_reminders",
            field=models.BooleanField(
                default=True,
                help_text="Клиент: получать напоминания о записи (24ч / 2ч).",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="notify_booking_status",
            field=models.BooleanField(
                default=True,
                help_text="Клиент: уведомления о подтверждении / отмене / завершении.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="telegram_chat_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="user",
            name="max_user_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="user",
            name="telegram_link_token",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]
