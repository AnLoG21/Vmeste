from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reviews", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="provider_seen_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
