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
    """Сохранённые карты (токен/маски — без полного PAN)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_payment_cards",
    )
    brand = models.CharField(max_length=32, blank=True, default="card")
    last4 = models.CharField(max_length=4)
    exp_month = models.PositiveSmallIntegerField(default=1)
    exp_year = models.PositiveSmallIntegerField(default=2030)
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
