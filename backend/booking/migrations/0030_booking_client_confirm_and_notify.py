from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0029_loyaltysettings_memory_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="client_confirm_token",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Токен публичной ссылки «подтвердить визит».",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="client_confirmed_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Когда клиент подтвердил визит по ссылке.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="providermessagingsettings",
            name="notify_client_on_new",
            field=models.BooleanField(
                default=True,
                help_text="Автоматически сообщать клиенту о новой записи (подтверждение / детали).",
            ),
        ),
        migrations.AddField(
            model_name="providermessagingsettings",
            name="send_client_confirm_link",
            field=models.BooleanField(
                default=True,
                help_text="Вкладывать в сообщение клиенту ссылку на подтверждение визита.",
            ),
        ),
        migrations.AddField(
            model_name="providermessagingsettings",
            name="client_new_booking_template",
            field=models.TextField(blank=True, default=""),
        ),
    ]
