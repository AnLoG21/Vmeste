import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("locations", "0002_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="providerlocation",
            name="provider",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="locations",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
