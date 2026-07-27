from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0013_availabilityslot_anonymous_index"),
    ]

    operations = [
        migrations.AddField(
            model_name="availabilityslot",
            name="service_ids",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Для «Без сотрудников»: ID услуг, которые можно оказать в этом интервале. Пусто — все услуги.",
            ),
        ),
    ]
