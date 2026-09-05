from django.conf import settings
from django.db import models


class MoyNalogAccount(models.Model):
    """Подключение кабинета «Мой налог» к организации (самозанятый)."""

    provider = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="moy_nalog_account",
    )
    inn = models.CharField(max_length=12, blank=True, default="")
    display_name = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    device_id = models.CharField(max_length=64, blank=True, default="")
    access_token_enc = models.TextField(blank=True, default="")
    refresh_token_enc = models.TextField(blank=True, default="")
    access_expires_at = models.DateTimeField(null=True, blank=True)
    enabled = models.BooleanField(default=True, help_text="Автовыдача чеков при оплате")
    connected_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Мой налог: аккаунт"
        verbose_name_plural = "Мой налог: аккаунты"

    def __str__(self):
        return f"MoyNalog<{self.provider_id} inn={self.inn}>"

    @property
    def is_connected(self) -> bool:
        return bool(self.refresh_token_enc and self.device_id)


class NpdReceipt(models.Model):
    class Source(models.TextChoices):
        BOOKING = "booking", "Запись"
        CAFE_ORDER = "cafe_order", "Заказ кафе"
        MANUAL = "manual", "Вручную"

    class Status(models.TextChoices):
        NONE = "none", "Нет"
        PENDING = "pending", "В процессе"
        ISSUED = "issued", "Выбит"
        FAILED = "failed", "Ошибка"
        MAYBE = "maybe", "Неизвестно (нужна проверка)"
        CANCELLED = "cancelled", "Аннулирован"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="npd_receipts",
    )
    source = models.CharField(max_length=16, choices=Source.choices)
    source_id = models.PositiveBigIntegerField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    service_name = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NONE, db_index=True)
    receipt_uuid = models.CharField(max_length=64, blank=True, default="", db_index=True)
    receipt_url = models.URLField(blank=True, default="")
    error_message = models.CharField(max_length=500, blank=True, default="")
    operation_time = models.DateTimeField(null=True, blank=True)
    attempted_at = models.DateTimeField(null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Мой налог: чек"
        verbose_name_plural = "Мой налог: чеки"
        constraints = [
            models.UniqueConstraint(fields=["source", "source_id"], name="uniq_npd_receipt_source"),
        ]
        indexes = [
            models.Index(fields=["provider", "-created_at"]),
        ]

    def __str__(self):
        return f"NpdReceipt<{self.source}:{self.source_id} {self.status}>"
