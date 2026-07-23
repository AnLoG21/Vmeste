from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0010_message_kind_payload"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="attachment",
            field=models.FileField(blank=True, null=True, upload_to="chat/%Y/%m/"),
        ),
        migrations.AlterField(
            model_name="message",
            name="kind",
            field=models.CharField(
                choices=[
                    ("text", "Text"),
                    ("review_reply", "Review reply"),
                    ("image", "Image"),
                    ("video", "Video"),
                    ("file", "File"),
                    ("voice", "Voice"),
                    ("video_note", "Video note"),
                    ("link", "Link"),
                ],
                default="text",
                max_length=20,
            ),
        ),
    ]
