from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0005_ingredients_service_charge_payouts"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafetable",
            name="guest_count",
            field=models.PositiveSmallIntegerField(
                default=0,
                validators=[django.core.validators.MaxValueValidator(30)],
            ),
        ),
        migrations.AddField(
            model_name="cafetable",
            name="is_occupied",
            field=models.BooleanField(default=False),
        ),
    ]
