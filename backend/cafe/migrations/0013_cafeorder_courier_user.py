import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0012_delivery_entrance_details"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="cafeorder",
            name="courier_user",
            field=models.ForeignKey(
                blank=True,
                help_text="Сотрудник-курьер, назначенный на доставку.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cafe_courier_orders",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
