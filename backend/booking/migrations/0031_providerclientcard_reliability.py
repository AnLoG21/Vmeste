from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0030_booking_client_confirm_and_notify"),
    ]

    operations = [
        migrations.AddField(
            model_name="providerclientcard",
            name="acquisition_source",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Откуда пришёл: соцсети, рекомендация, реклама…",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="providerclientcard",
            name="hidden",
            field=models.BooleanField(
                default=False,
                help_text="Скрыть из базы клиентов организации.",
            ),
        ),
        migrations.AddField(
            model_name="providerclientcard",
            name="is_blocked",
            field=models.BooleanField(
                default=False,
                help_text="Блокировка онлайн-записи (чёрный список).",
            ),
        ),
        migrations.AddField(
            model_name="providerclientcard",
            name="no_show_count",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Сколько раз клиент не пришёл без предупреждения.",
            ),
        ),
    ]
