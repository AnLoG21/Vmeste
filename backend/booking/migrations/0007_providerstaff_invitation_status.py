from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("booking", "0006_providerstaff_job_title"),
    ]

    operations = [
        migrations.AddField(
            model_name="providerstaff",
            name="invitation_status",
            field=models.CharField(
                choices=[
                    ("pending", "Ожидает подтверждения"),
                    ("accepted", "Принято"),
                    ("rejected", "Отклонено"),
                ],
                default="accepted",
                max_length=20,
            ),
        ),
    ]
