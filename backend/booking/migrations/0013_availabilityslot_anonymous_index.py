from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0012_alter_booking_slot_nullable"),
    ]

    operations = [
        migrations.AddField(
            model_name="availabilityslot",
            name="anonymous_index",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="Номер «Без сотрудников N» при staff=null.",
                null=True,
            ),
        ),
    ]
