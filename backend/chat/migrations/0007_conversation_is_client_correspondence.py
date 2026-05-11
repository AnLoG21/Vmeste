from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0006_alter_conversation_is_saved_messages"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="is_client_correspondence",
            field=models.BooleanField(default=False),
        ),
    ]
