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
    yandex_disk_token = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="OAuth-токен Яндекс Диска для загрузки фото карточек.",
    )
    webhook_secret = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Секрет для входящего webhook синхронизации.",
    )
    low_stock_threshold = models.PositiveIntegerField(
        default=5,
        help_text="Порог алерта «низкий остаток» (шт.).",
    )
    price_protect_enabled = models.BooleanField(
        default=False,
        help_text="Защита цены: мин. цена и отключение автоскидок при выгрузке цен.",
    )
    price_min_floor_percent = models.PositiveIntegerField(
        default=10,
        help_text="Мин. цена = цена × (100 − N)% / 100. Например 10 → не ниже 90% от цены.",
    )
    ozon_disable_auto_actions = models.BooleanField(
        default=True,
        help_text="При защите цены отправлять auto_action_enabled=DISABLED на Ozon.",
    )
    notify_telegram = models.BooleanField(default=True)
    notify_push = models.BooleanField(default=True)
    notify_on_new_orders = models.BooleanField(default=True)
    notify_on_sync_errors = models.BooleanField(default=True)
    last_seen_order_ids = models.JSONField(default=dict, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    # offer_id / nm key → себестоимость ₽ (для юнит-экономики)
    sku_costs = models.JSONField(default=dict, blank=True)
    # Правила СПП-репрайса: [{offer_id, nm_id, target_buyer_price, supplier_discount}]
    spp_rules = models.JSONField(default=list, blank=True)
    spp_reprice_enabled = models.BooleanField(
        default=False,
        help_text="Умная защита цены с учётом СПП WB (полуавто).",
    )
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


class MarketplaceCardDesign(models.Model):
    """User-owned visual slide template for marketplace product photos."""

    LAYOUT_CHOICES = [
        ("hero", "Главный кадр"),
        ("benefits", "Преимущества"),
        ("specs", "Характеристики"),
    ]

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_card_designs",
    )
    name = models.CharField(max_length=180)
    layout = models.CharField(max_length=32, choices=LAYOUT_CHOICES, default="hero")
    # Colors, brand bar text, titles, logo URL, toggles
    style = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]


class MarketplaceReplyTemplate(models.Model):
    KIND_REVIEW = "review"
    KIND_QUESTION = "question"
    KIND_CHOICES = [
        (KIND_REVIEW, "Отзыв"),
        (KIND_QUESTION, "Вопрос"),
    ]

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_reply_templates",
    )
    name = models.CharField(max_length=180)
    marketplace = models.CharField(max_length=20, choices=[("ozon", "Ozon"), ("wildberries", "Wildberries"), ("any", "Любая")])
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=KIND_REVIEW)
    body = models.TextField()
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


class MarketplaceRepriceLog(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_reprice_logs",
    )
    marketplace = models.CharField(max_length=20, default="wildberries")
    offer_id = models.CharField(max_length=128, blank=True, default="")
    nm_id = models.CharField(max_length=64, blank=True, default="")
    old_price = models.PositiveIntegerField(default=0)
    new_price = models.PositiveIntegerField(default=0)
    spp_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    reason = models.CharField(max_length=400, blank=True, default="")
    applied = models.BooleanField(default=False)
    sandbox = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
