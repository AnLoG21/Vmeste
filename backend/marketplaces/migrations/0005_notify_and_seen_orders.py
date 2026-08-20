from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplaces", "0004_alerts_price_reply_templates"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplacesettings",
            name="notify_telegram",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="notify_push",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="notify_on_new_orders",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="notify_on_sync_errors",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="marketplacesettings",
            name="last_seen_order_ids",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
