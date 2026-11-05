from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("vefire", "0002_agentheartbeat"),
    ]

    operations = [
        migrations.AddField(
            model_name="agentheartbeat",
            name="last_jpeg",
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="agentheartbeat",
            name="frame_width",
            field=models.PositiveIntegerField(default=1280),
        ),
        migrations.AddField(
            model_name="agentheartbeat",
            name="frame_height",
            field=models.PositiveIntegerField(default=720),
        ),
        migrations.AddField(
            model_name="agentheartbeat",
            name="frame_updated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="agentheartbeat",
            name="input_queue",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name="agentheartbeat",
            name="remote_url",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
    ]
