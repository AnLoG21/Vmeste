from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0005_alter_providerstaff_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="providerstaff",
            name="job_title",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
