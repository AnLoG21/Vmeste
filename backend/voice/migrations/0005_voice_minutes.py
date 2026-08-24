# Generated for voice minute quota

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("voice", "0004_sip_asterisk"),
    ]

    operations = [
        migrations.AddField(
            model_name="providervoicesettings",
            name="voice_minutes_period_start",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="providervoicesettings",
            name="voice_minutes_quota",
            field=models.DecimalField(
                decimal_places=1,
                default=30,
                help_text="Лимит минут SpeechKit в месяц (0 = без лимита).",
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="providervoicesettings",
            name="voice_minutes_used",
            field=models.DecimalField(decimal_places=1, default=0, max_digits=8),
        ),
    ]
