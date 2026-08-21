from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0010_table_waiter_call"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="cafeorder",
            name="client",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cafe_client_orders",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="courier_lat",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="courier_lon",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="courier_updated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="delivery_lat",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="cafeorder",
            name="delivery_lon",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AlterField(
            model_name="cafeorder",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Черновик"),
                    ("awaiting_payment", "Ожидает оплаты"),
                    ("paid", "Оплачен"),
                    ("accepted", "Принят"),
                    ("cooking", "Готовится"),
                    ("ready", "Готов"),
                    ("to_courier", "Передаём курьеру"),
                    ("delivering", "В пути"),
                    ("done", "Завершён"),
                    ("cancelled", "Отменён"),
                ],
                default="draft",
                max_length=30,
            ),
        ),
    ]
