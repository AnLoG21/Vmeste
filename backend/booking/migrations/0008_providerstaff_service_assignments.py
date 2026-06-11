from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0003_alter_service_category"),
        ("booking", "0007_providerstaff_invitation_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="providerstaff",
            name="assigned_categories",
            field=models.ManyToManyField(
                blank=True,
                related_name="staff_assignments",
                to="catalog.servicecategory",
            ),
        ),
        migrations.AddField(
            model_name="providerstaff",
            name="assigned_services",
            field=models.ManyToManyField(
                blank=True,
                related_name="staff_assignments",
                to="catalog.service",
            ),
        ),
    ]
