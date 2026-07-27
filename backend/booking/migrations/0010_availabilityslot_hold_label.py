# Generated manually for AvailabilitySlot.hold_label

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0009_alter_availabilityslot_staff"),
    ]

    operations = [
        migrations.AddField(
            model_name="availabilityslot",
            name="hold_label",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
