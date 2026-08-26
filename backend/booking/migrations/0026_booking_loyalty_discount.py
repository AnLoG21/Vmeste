from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0025_no_show_and_waitlist"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="loyalty_points_redeemed",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Сколько баллов списано при создании записи.",
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="loyalty_discount",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Скидка в рублях за списанные баллы (учитывается в предоплате).",
                max_digits=10,
            ),
        ),
    ]
