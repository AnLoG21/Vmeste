from django.conf import settings
from django.db import models


class ShopFavorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shop_favorites",
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorited_by_clients",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "provider"], name="uniq_vmagazine_shop_favorite"),
        ]
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"ShopFavorite(user={self.user_id}, provider={self.provider_id})"


class ProductLike(models.Model):
    """Избранные товары (лайк)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="product_likes",
    )
    product = models.ForeignKey(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "product"], name="uniq_vmagazine_product_like"),
        ]
        ordering = ["-created_at", "-id"]


class CartItem(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vmagazine_cart_items",
    )
    product = models.ForeignKey(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="cart_lines",
    )
    quantity = models.PositiveIntegerField(default=1)
    use_bonuses = models.BooleanField(default=False)
    selected_size = models.CharField(max_length=32, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "product"], name="uniq_vmagazine_cart_item"),
        ]
        ordering = ["-updated_at", "-id"]


class ProductViewHistory(models.Model):
    """Недавно просмотренные карточки товаров (до 80 на пользователя)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="product_view_history",
    )
    product = models.ForeignKey(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="view_events",
    )
    viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "product"], name="uniq_vmagazine_product_view"),
        ]
        ordering = ["-viewed_at", "-id"]


class DeliveryAddress(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vmagazine_addresses",
    )
    label = models.CharField(max_length=80, blank=True, default="Дом")
    address = models.CharField(max_length=400)
    entrance = models.CharField(max_length=32, blank=True, default="")
    floor = models.CharField(max_length=32, blank=True, default="")
    apartment = models.CharField(max_length=64, blank=True, default="")
    intercom = models.CharField(max_length=64, blank=True, default="")
    extra = models.CharField(max_length=255, blank=True, default="")
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_default", "-id"]


class ShopBonusBalance(models.Model):
    """Бонусы пользователя в конкретном магазине (Вбонусы)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shop_bonus_balances",
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="client_bonus_balances",
    )
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "provider"], name="uniq_vmagazine_shop_bonus"),
        ]


class BonusLedgerEntry(models.Model):
    class Kind(models.TextChoices):
        EARN = "earn", "Начисление"
        SPEND = "spend", "Списание"
        ADJUST = "adjust", "Корректировка"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bonus_ledger",
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bonus_ledger_as_shop",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    order = models.ForeignKey(
        "shop.ShopOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bonus_entries",
    )
    note = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class SavedPaymentCard(models.Model):
    """Сохранённые карты: маска + опционально payment_method_id ЮKassa (привязка к магазину)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_payment_cards",
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="customer_saved_cards",
        help_text="Магазин, у которого привязана карта (токен ЮKassa нельзя переиспользовать между магазинами)",
    )
    brand = models.CharField(max_length=32, blank=True, default="card")
    last4 = models.CharField(max_length=4)
    exp_month = models.PositiveSmallIntegerField(default=1)
    exp_year = models.PositiveSmallIntegerField(default=2030)
    yookassa_payment_method_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_default", "-id"]


class PopularSearchQuery(models.Model):
    query = models.CharField(max_length=120, unique=True)
    hits = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-hits", "query"]


class ReturnRequest(models.Model):
    """Заявка на возврат товара из завершённого заказа."""

    class Status(models.TextChoices):
        PENDING = "pending", "На рассмотрении"
        APPROVED = "approved", "Одобрен"
        REJECTED = "rejected", "Отклонён"
        DONE = "done", "Выполнен"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shop_return_requests",
    )
    order = models.ForeignKey(
        "shop.ShopOrder",
        on_delete=models.CASCADE,
        related_name="return_requests",
    )
    order_item = models.ForeignKey(
        "shop.ShopOrderItem",
        on_delete=models.CASCADE,
        related_name="return_requests",
    )
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    seller_note = models.CharField(max_length=500, blank=True, default="")
    refund_id = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class ReturnRequestPhoto(models.Model):
    """Фото к заявке на возврат (обязательны при создании)."""

    return_request = models.ForeignKey(
        ReturnRequest,
        on_delete=models.CASCADE,
        related_name="photos",
    )
    image = models.ImageField(upload_to="return_photos/%Y/%m/")
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
