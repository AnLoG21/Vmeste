import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("vmagazine", "0004_cart_size_returns"),
    ]

    operations = [
        migrations.AddField(
            model_name="savedpaymentcard",
            name="provider",
            field=models.ForeignKey(
                blank=True,
                help_text="Магазин, у которого привязана карта (токен ЮKassa нельзя переиспользовать между магазинами)",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="customer_saved_cards",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="savedpaymentcard",
            name="yookassa_payment_method_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="returnrequest",
            name="refund_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="returnrequest",
            name="seller_note",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
    ]
