from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inspections", "0002_repair_status_and_vehicle_flow"),
    ]

    operations = [
        migrations.AlterField(
            model_name="inspectionreport",
            name="repair_status",
            field=models.CharField(
                choices=[
                    ("none", "—"),
                    ("waiting_parts", "Ждём запчасти"),
                    ("in_progress", "В работе"),
                    ("ready", "Готов"),
                    ("handed_over", "Выдан клиенту"),
                ],
                db_index=True,
                default="none",
                help_text="Статус ремонта после утверждения клиентом.",
                max_length=20,
            ),
        ),
    ]
