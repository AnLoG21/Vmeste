from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0007_conversation_is_client_correspondence"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversationmember",
            name="last_read_message_id",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
