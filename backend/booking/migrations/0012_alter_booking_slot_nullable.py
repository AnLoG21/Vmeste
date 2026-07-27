import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0011_providerstaff_avatar_bio_portfolio"),
    ]

    operations = [
        migrations.AlterField(
            model_name="booking",
            name="slot",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="booking",
                to="booking.availabilityslot",
            ),
        ),
    ]
