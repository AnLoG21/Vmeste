from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0006_user_booking_cancel_message_default_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="booking_done_message_default",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Сообщение клиенту при отметке «услуга оказана».",
            ),
        ),
    ]
