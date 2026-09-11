from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0031_providerclientcard_reliability"),
        ("locations", "0004_providerlocation_address_extras"),
    ]

    operations = [
        migrations.AddField(
            model_name="availabilityslot",
            name="location",
            field=models.ForeignKey(
                blank=True,
                help_text="Филиал; пусто — основной адрес организации.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="slots",
                to="locations.providerlocation",
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="location",
            field=models.ForeignKey(
                blank=True,
                help_text="Филиал записи (копируется со слота).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="bookings",
                to="locations.providerlocation",
            ),
        ),
    ]
