import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0002_initial"),
        ("users", "0003_remove_user_full_name_user_email_verification_token_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="organization_conversations",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
