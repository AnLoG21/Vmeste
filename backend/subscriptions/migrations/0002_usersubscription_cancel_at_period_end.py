from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="usersubscription",
            name="cancel_at_period_end",
            field=models.BooleanField(
                default=False,
                help_text="Подписка не продлевается; доступ сохраняется до period_end.",
            ),
        ),
    ]
