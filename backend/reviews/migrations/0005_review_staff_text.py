from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0004_review_staff_rating"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="staff_text",
            field=models.TextField(blank=True, default=""),
        ),
    ]
