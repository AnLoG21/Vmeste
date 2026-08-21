import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0022_visitpackage_cover_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="client_package",
            field=models.ForeignKey(
                blank=True,
                help_text="Абонемент, списанный при оплате/записи.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="bookings_used",
                to="booking.clientpackage",
            ),
        ),
    ]
