# Generated manually for voice legal / 152-FZ disclosure

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("voice", "0005_voice_minutes"),
    ]

    operations = [
        migrations.AddField(
            model_name="providervoicesettings",
            name="legal_ack",
            field=models.BooleanField(
                default=False,
                help_text="Салон подтвердил понимание 152-ФЗ / SpeechKit / уведомление звонящего.",
            ),
        ),
        migrations.AddField(
            model_name="providervoicesettings",
            name="caller_disclosure",
            field=models.TextField(
                blank=True,
                default=(
                    "Разговор обрабатывается голосовым ассистентом сервиса Вместе "
                    "(распознавание речи Яндекс SpeechKit). Продолжая разговор, "
                    "вы соглашаетесь с обработкой голосовых данных."
                ),
                help_text="Фраза в начале звонка про обработку голоса (152-ФЗ).",
            ),
        ),
    ]
