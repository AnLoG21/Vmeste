import secrets

from django.conf import settings
from django.db import models


def _voice_webhook_token() -> str:
    return secrets.token_urlsafe(24)


class ProviderVoiceSettings(models.Model):
    class AtsProvider(models.TextChoices):
        GENERIC = "generic", "Generic JSON"
        MANGO = "mango", "Mango Office"
        NOVOFON = "novofon", "Novofon / UIS"

    provider = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="voice_settings",
    )
    enabled = models.BooleanField(default=False)
    webhook_token = models.CharField(max_length=64, unique=True, default=_voice_webhook_token)
    inbound_phone = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Номер салона для сопоставления входящих (опционально).",
    )
    transfer_phone = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Перевод на живого администратора.",
    )
    greeting_text = models.TextField(
        blank=True,
        default="Здравствуйте! Это голосовой администратор. Помогу записаться на услугу. Скажите, что вас интересует.",
    )
    ats_provider = models.CharField(
        max_length=16,
        choices=AtsProvider.choices,
        default=AtsProvider.GENERIC,
    )
    confirm_outbound_enabled = models.BooleanField(
        default=False,
        help_text="Исходящие звонки для подтверждения записи (фаза 2).",
    )
    tts_enabled = models.BooleanField(
        default=False,
        help_text="Озвучивать ответы через Yandex SpeechKit (поле say_audio_base64 в webhook).",
    )
    mango_api_key = models.CharField(max_length=128, blank=True, default="")
    mango_api_salt = models.CharField(max_length=128, blank=True, default="")
    mango_line_number = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Исходящая линия Mango (номер салона).",
    )
    mango_extension = models.CharField(
        max_length=16,
        blank=True,
        default="",
        help_text="Внутренний добавочный (опционально).",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def has_mango(self) -> bool:
        return bool((self.mango_api_key or "").strip() and (self.mango_api_salt or "").strip())

    def save(self, *args, **kwargs):
        if not (self.webhook_token or "").strip():
            self.webhook_token = _voice_webhook_token()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Voice {self.provider_id}"


class VoiceCallSession(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Активен"
        COMPLETED = "completed", "Завершён"
        TRANSFERRED = "transferred", "Перевод"
        FAILED = "failed", "Ошибка"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="voice_sessions",
    )
    external_call_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    caller_phone = models.CharField(max_length=32, blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    context = models.JSONField(default=dict, blank=True)
    booking = models.ForeignKey(
        "booking.Booking",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="voice_sessions",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"VoiceSession {self.id} ({self.status})"


class VoiceCallTurn(models.Model):
    class Role(models.TextChoices):
        USER = "user", "Клиент"
        ASSISTANT = "assistant", "Ассистент"
        SYSTEM = "system", "Система"
        TOOL = "tool", "Инструмент"

    session = models.ForeignKey(VoiceCallSession, on_delete=models.CASCADE, related_name="turns")
    role = models.CharField(max_length=16, choices=Role.choices)
    text = models.TextField(blank=True, default="")
    tool_name = models.CharField(max_length=64, blank=True, default="")
    tool_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class VoiceOutboundLog(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "В очереди"
        DIALING = "dialing", "Набор"
        DONE = "done", "Завершён"
        FAILED = "failed", "Ошибка"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="voice_outbound_logs",
    )
    booking = models.ForeignKey(
        "booking.Booking",
        on_delete=models.CASCADE,
        related_name="voice_outbound_logs",
    )
    phone = models.CharField(max_length=32, blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    external_command_id = models.CharField(max_length=64, blank=True, default="")
    session = models.ForeignKey(
        VoiceCallSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="outbound_logs",
    )
    error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
