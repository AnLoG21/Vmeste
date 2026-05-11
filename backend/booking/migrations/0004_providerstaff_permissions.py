# Generated manually

from django.db import migrations, models


def fill_default_permissions(apps, schema_editor):
    ProviderStaff = apps.get_model("booking", "ProviderStaff")
    d = {
        "manage_bookings": True,
        "manage_intervals": False,
        "manage_services": False,
        "manage_chats": True,
        "manage_staff": False,
    }
    for row in ProviderStaff.objects.all():
        if not row.permissions:
            row.permissions = d
            row.save(update_fields=["permissions"])


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0003_availabilityslot_recurrence_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="providerstaff",
            name="permissions",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(fill_default_permissions, migrations.RunPython.noop),
    ]
