from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reviews", "0002_review_provider_seen_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="supplemented_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
