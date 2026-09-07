# Generated manually: product authenticity, views, bonuses

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shop", "0004_russian_post_dostavista"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="view_count",
            field=models.PositiveIntegerField(db_index=True, default=0),
        ),
        migrations.AddField(
            model_name="product",
            name="authenticity_status",
            field=models.CharField(
                choices=[
                    ("none", "Не заявлен"),
                    ("pending", "На проверке"),
                    ("verified", "Оригинал подтверждён"),
                    ("rejected", "Отклонён"),
                ],
                db_index=True,
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="authenticity_note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="product",
            name="authenticity_requested_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="authenticity_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="bonus_points",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Бонусы за покупку 1 шт (0 = по правилам магазина)",
            ),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="bonus_earn_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="% от суммы позиций в бонусы при завершении заказа",
                max_digits=5,
            ),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="bonus_max_spend_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=50,
                help_text="Макс. % заказа, который можно оплатить бонусами",
                max_digits=5,
            ),
        ),
    ]
