from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0009_alter_conversation_is_saved_messages"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="kind",
            field=models.CharField(
                choices=[("text", "Text"), ("review_reply", "Review reply")],
                default="text",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="message",
            name="payload",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="message",
            name="text",
            field=models.TextField(blank=True, default=""),
        ),
    ]
