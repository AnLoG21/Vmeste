from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class ProductCategory(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="product_categories"
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    name = models.CharField(max_length=120)
    sort_order = models.PositiveIntegerField(default=0)
    pool_key = models.CharField(
        max_length=120,
        blank=True,
        default="",
        db_index=True,
        help_text="Ключ из пула готовых категорий (если добавлена из каталога)",
    )

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "pool_key"],
                condition=models.Q(pool_key__gt=""),
                name="uniq_provider_product_category_pool_key",
            ),
        ]


class ProductSubcategory(models.Model):
    category = models.ForeignKey(
        ProductCategory, on_delete=models.CASCADE, related_name="subcategories"
    )
    name = models.CharField(max_length=120)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class Product(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="products"
    )
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )
    subcategory = models.ForeignKey(
        ProductSubcategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True, default="")
    sku = models.CharField(max_length=64, blank=True, default="")
    unit = models.CharField(max_length=32, blank=True, default="шт")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    attrs = models.JSONField(blank=True, default=dict, help_text="Характеристики: {ключ: значение}")
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    featured_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]


class ProductPhoto(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="product_photos/%Y/%m/")
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]


class StockMovement(models.Model):
    class Kind(models.TextChoices):
        IN = "in", "Приход"
        OUT_MANUAL = "out_manual", "Ручное списание"
        OUT_SERVICE = "out_service", "Списание по услуге"
        OUT_ORDER = "out_order", "Списание по заказу"
        ADJUST = "adjust", "Корректировка"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="stock_movements"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_movements")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    qty = models.DecimalField(max_digits=12, decimal_places=3)
    reason = models.CharField(max_length=255, blank=True, default="")
    booking = models.ForeignKey(
        "booking.Booking",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    shop_order = models.ForeignKey(
        "shop.ShopOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    idempotency_key = models.CharField(max_length=120, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["idempotency_key"],
                condition=models.Q(idempotency_key__gt=""),
                name="uniq_stock_movement_idempotency",
            ),
        ]


class ServiceMaterial(models.Model):
    """Норма расхода товара на услугу (BOM)."""

    service = models.ForeignKey(
        "catalog.Service", on_delete=models.CASCADE, related_name="materials"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="service_usages")
    qty_per_service = models.DecimalField(
        max_digits=12, decimal_places=3, default=Decimal("1"), validators=[MinValueValidator(Decimal("0.001"))]
    )

    class Meta:
        unique_together = [("service", "product")]
        ordering = ["id"]


class ShopSettings(models.Model):
    class DeliveryProviderKind(models.TextChoices):
        OWN = "own", "Свой курьер"
        YANDEX = "yandex", "Яндекс Доставка"
        CDEK = "cdek", "СДЭК"

    provider = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shop_settings",
    )
    enable_pickup = models.BooleanField(default=True)
    enable_delivery = models.BooleanField(default=False)
    delivery_info = models.TextField(blank=True, default="")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_min_order = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_zones = models.JSONField(
        blank=True,
        default=list,
        help_text="Зоны доставки: [{id,name,color,fee,min_order,polygon:[[lat,lon],…]}]",
    )
    delivery_provider = models.CharField(
        max_length=20,
        choices=DeliveryProviderKind.choices,
        default=DeliveryProviderKind.OWN,
    )
    yandex_delivery_token = models.CharField(max_length=255, blank=True, default="")
    cdek_client_id = models.CharField(max_length=128, blank=True, default="")
    cdek_client_secret = models.CharField(max_length=128, blank=True, default="")
    accept_online_payment = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)


class ShopOrder(models.Model):
    class Mode(models.TextChoices):
        PICKUP = "pickup", "Самовывоз"
        DELIVERY = "delivery", "Доставка"

    class Status(models.TextChoices):
        AWAITING_PAYMENT = "awaiting_payment", "Ожидает оплаты"
        PAID = "paid", "Оплачен"
        ASSEMBLING = "assembling", "Собирается"
        READY = "ready", "Готов"
        TO_COURIER = "to_courier", "Передаём курьеру"
        DELIVERING = "delivering", "В пути"
        DONE = "done", "Завершён"
        CANCELLED = "cancelled", "Отменён"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shop_orders"
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shop_client_orders",
    )
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.PICKUP)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.AWAITING_PAYMENT, db_index=True
    )
    guest_name = models.CharField(max_length=120, blank=True, default="")
    guest_phone = models.CharField(max_length=32, blank=True, default="")
    guest_email = models.EmailField(blank=True, default="")
    delivery_address = models.CharField(max_length=400, blank=True, default="")
    apartment = models.CharField(max_length=32, blank=True, default="")
    entrance = models.CharField(max_length=32, blank=True, default="")
    intercom = models.CharField(max_length=32, blank=True, default="")
    private_house = models.BooleanField(default=False)
    delivery_lat = models.FloatField(null=True, blank=True)
    delivery_lon = models.FloatField(null=True, blank=True)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    items_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    courier_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shop_courier_orders",
    )
    courier_lat = models.FloatField(null=True, blank=True)
    courier_lon = models.FloatField(null=True, blank=True)
    courier_updated_at = models.DateTimeField(null=True, blank=True)
    external_delivery_provider = models.CharField(max_length=20, blank=True, default="")
    external_tracking_id = models.CharField(max_length=120, blank=True, default="")
    yookassa_payment_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    confirmation_url = models.URLField(blank=True, default="")
    paid_at = models.DateTimeField(null=True, blank=True)
    stock_written_off = models.BooleanField(default=False)
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class ShopOrderItem(models.Model):
    order = models.ForeignKey(ShopOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_lines"
    )
    name = models.CharField(max_length=180)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)])

    @property
    def line_total(self):
        return self.unit_price * self.quantity
