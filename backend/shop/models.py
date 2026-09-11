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
    sizes = models.JSONField(
        blank=True,
        default=list,
        help_text="Доступные размеры: [\"S\", \"M\", …]",
    )
    related_products = models.ManyToManyField(
        "self",
        blank=True,
        symmetrical=False,
        related_name="related_from",
    )
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    featured_order = models.PositiveSmallIntegerField(default=0)
    view_count = models.PositiveIntegerField(default=0, db_index=True)
    class AuthenticityStatus(models.TextChoices):
        NONE = "none", "Не заявлен"
        PENDING = "pending", "На проверке"
        VERIFIED = "verified", "Оригинал подтверждён"
        REJECTED = "rejected", "Отклонён"

    authenticity_status = models.CharField(
        max_length=20,
        choices=AuthenticityStatus.choices,
        default=AuthenticityStatus.NONE,
        db_index=True,
    )
    authenticity_note = models.TextField(blank=True, default="")
    authenticity_requested_at = models.DateTimeField(null=True, blank=True)
    authenticity_verified_at = models.DateTimeField(null=True, blank=True)
    bonus_points = models.PositiveIntegerField(
        default=0,
        help_text="Бонусы за покупку 1 шт (0 = по правилам магазина)",
    )
    weight_grams = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Вес единицы товара в граммах (для доставки). Пусто = 300 г.",
    )
    length_mm = models.PositiveIntegerField(null=True, blank=True, help_text="Длина, мм")
    width_mm = models.PositiveIntegerField(null=True, blank=True, help_text="Ширина, мм")
    height_mm = models.PositiveIntegerField(null=True, blank=True, help_text="Высота, мм")
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
        RUSSIAN_POST = "russian_post", "Почта России"
        DOSTAVISTA = "dostavista", "Dostavista"

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
        help_text="Устарело: используйте enable_* флаги. Оставлено для совместимости.",
    )
    enable_own_courier = models.BooleanField(default=True)
    enable_yandex_delivery = models.BooleanField(default=False)
    enable_cdek_delivery = models.BooleanField(default=False)
    enable_russian_post = models.BooleanField(default=False)
    enable_dostavista = models.BooleanField(default=False)
    own_eta_text = models.CharField(max_length=80, blank=True, default="1–3 часа")
    yandex_eta_text = models.CharField(max_length=80, blank=True, default="от 40 минут")
    cdek_eta_text = models.CharField(max_length=80, blank=True, default="1–5 дней")
    russian_post_eta_text = models.CharField(max_length=80, blank=True, default="3–10 дней")
    dostavista_eta_text = models.CharField(max_length=80, blank=True, default="1–3 часа")
    yandex_delivery_token = models.CharField(max_length=255, blank=True, default="")
    cdek_client_id = models.CharField(max_length=128, blank=True, default="")
    cdek_client_secret = models.CharField(max_length=128, blank=True, default="")
    russian_post_token = models.CharField(max_length=255, blank=True, default="")
    russian_post_user_key = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Ключ X-User-Authorization (Basic …) из ЛК Отправка",
    )
    dostavista_token = models.CharField(max_length=255, blank=True, default="")
    accept_online_payment = models.BooleanField(default=True)
    bonus_earn_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="% от суммы позиций в бонусы при завершении заказа",
    )
    bonus_max_spend_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=50,
        help_text="Макс. % заказа, который можно оплатить бонусами",
    )
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
    chosen_delivery_provider = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Способ доставки, выбранный покупателем: own|yandex|cdek|russian_post|dostavista",
    )
    eta_text = models.CharField(max_length=80, blank=True, default="")
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
    bonus_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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
    selected_size = models.CharField(max_length=32, blank=True, default="")

    @property
    def line_total(self):
        return self.unit_price * self.quantity
