from django.conf import settings
from django.db import models


class MarketplaceSettings(models.Model):
    provider = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_settings",
    )
    environment = models.CharField(
        max_length=16,
        default="sandbox",
        choices=[("sandbox", "Песочница"), ("prod", "Боевой")],
    )
    ozon_client_id = models.CharField(max_length=128, blank=True, default="")
    ozon_api_key = models.CharField(max_length=256, blank=True, default="")
    wb_api_key = models.CharField(max_length=512, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def has_ozon(self) -> bool:
        return bool((self.ozon_client_id or "").strip() and (self.ozon_api_key or "").strip())

    def has_wb(self) -> bool:
        return bool((self.wb_api_key or "").strip())


class MarketplaceProductHistory(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_products",
    )
    marketplace = models.CharField(max_length=20, choices=[("ozon", "Ozon"), ("wildberries", "Wildberries")])
    offer_id = models.CharField(max_length=128, db_index=True)
    product_data = models.JSONField(default=dict)
    status = models.CharField(max_length=32, default="pending")
    response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        indexes = [
            models.Index(fields=["provider", "marketplace", "offer_id"], name="marketplace_provide_idx"),
        ]


class MarketplaceTemplate(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_templates",
    )
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True, default="")
    marketplace = models.CharField(max_length=20, choices=[("ozon", "Ozon"), ("wildberries", "Wildberries")])
    brand = models.CharField(max_length=180, blank=True, default="")
    description_text = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class MarketplaceApiLog(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_api_logs",
        null=True,
        blank=True,
    )
    marketplace = models.CharField(max_length=20, blank=True, default="")
    endpoint = models.CharField(max_length=255)
    method = models.CharField(max_length=8)
    status_code = models.IntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
