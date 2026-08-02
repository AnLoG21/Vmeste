from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cafe", "0006_table_occupancy"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafesettings",
            name="logo",
            field=models.ImageField(blank=True, null=True, upload_to="cafe_logos/%Y/%m/"),
        ),
    ]
