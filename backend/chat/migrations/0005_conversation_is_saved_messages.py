from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0004_alter_conversation_organization"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="is_saved_messages",
            field=models.BooleanField(default=False),
        ),
    ]
