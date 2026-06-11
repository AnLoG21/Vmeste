from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_user_organization_address_parts"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="last_seen_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
