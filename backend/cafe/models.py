import secrets
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models


pin_validator = RegexValidator(r"^\d{6}$", "Пароль стола — ровно 6 цифр.")


class CafeSettings(models.Model):
    provider = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cafe_settings",
    )
    enable_dine_in = models.BooleanField(default=True)
    enable_takeaway = models.BooleanField(default=True)
    enable_delivery = models.BooleanField(default=False)
    delivery_info = models.TextField(blank=True, default="")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_min_order = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    accept_online_payment = models.BooleanField(default=True)
    accept_cash = models.BooleanField(default=True)
    accept_card_on_spot = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CafeSettings<{self.provider_id}>"


class CafeFloorPlan(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cafe_floor_plans",
    )
    name = models.CharField(max_length=120, default="Основной зал")
    width = models.PositiveIntegerField(default=800)
    height = models.PositiveIntegerField(default=600)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} ({self.provider_id})"


class CafeTable(models.Model):
    floor_plan = models.ForeignKey(CafeFloorPlan, on_delete=models.CASCADE, related_name="tables")
    label = models.CharField(max_length=64, default="Стол")
    x = models.FloatField(default=40)
    y = models.FloatField(default=40)
    width = models.FloatField(default=80)
    height = models.FloatField(default=80)
    rotation = models.FloatField(default=0)
    seats = models.PositiveSmallIntegerField(default=2, validators=[MinValueValidator(1), MaxValueValidator(30)])
    pin_code = models.CharField(max_length=6, validators=[pin_validator], default="000000")
    public_token = models.CharField(max_length=32, unique=True, db_index=True, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def save(self, *args, **kwargs):
        if not self.public_token:
            self.public_token = secrets.token_urlsafe(16)[:32]
        if not self.pin_code or len(self.pin_code) != 6:
            self.pin_code = f"{secrets.randbelow(1_000_000):06d}"
        super().save(*args, **kwargs)

    @property
    def provider_id(self):
        return self.floor_plan.provider_id

    def __str__(self):
        return f"{self.label} #{self.pk}"


class CafeMenuCategory(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cafe_menu_categories",
    )
    name = models.CharField(max_length=120)
    sort_order = models.PositiveIntegerField(default=0)
    is_novelties = models.BooleanField(
        default=False,
        help_text="Категория «Новинки» — показывается первой.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_novelties", "sort_order", "id"]
        verbose_name_plural = "cafe menu categories"

    def __str__(self):
        return self.name


class CafeMenuItem(models.Model):
    category = models.ForeignKey(CafeMenuCategory, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True, default="")
    composition = models.TextField(blank=True, default="", help_text="Состав")
    weight_grams = models.PositiveIntegerField(null=True, blank=True)
    calories = models.PositiveIntegerField(null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_new = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]

    @property
    def provider_id(self):
        return self.category.provider_id

    def __str__(self):
        return self.name


class CafeMenuItemPhoto(models.Model):
    item = models.ForeignKey(CafeMenuItem, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="cafe_menu/%Y/%m/")
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]


class CafeGuestSession(models.Model):
    """Короткоживущая сессия после ввода PIN стола."""

    token = models.CharField(max_length=64, unique=True, db_index=True)
    table = models.ForeignKey(CafeTable, on_delete=models.CASCADE, related_name="sessions")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    @classmethod
    def create_for_table(cls, table, hours=8):
        from django.utils import timezone
        from datetime import timedelta

        return cls.objects.create(
            token=secrets.token_urlsafe(32),
            table=table,
            expires_at=timezone.now() + timedelta(hours=hours),
        )


class CafeOrder(models.Model):
    class Mode(models.TextChoices):
        DINE_IN = "dine_in", "За столом"
        TAKEAWAY = "takeaway", "Самовывоз"
        DELIVERY = "delivery", "Доставка"

    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        AWAITING_PAYMENT = "awaiting_payment", "Ожидает оплаты"
        PAID = "paid", "Оплачен"
        ACCEPTED = "accepted", "Принят"
        COOKING = "cooking", "Готовится"
        READY = "ready", "Готов"
        DELIVERING = "delivering", "Доставляется"
        DONE = "done", "Завершён"
        CANCELLED = "cancelled", "Отменён"

    class PayMethod(models.TextChoices):
        ONLINE = "online", "Онлайн"
        CASH = "cash", "Наличные"
        CARD_ON_SPOT = "card_on_spot", "Картой на месте"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cafe_orders",
    )
    table = models.ForeignKey(
        CafeTable,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.DINE_IN)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    pay_method = models.CharField(max_length=20, choices=PayMethod.choices, default=PayMethod.ONLINE)
    guest_name = models.CharField(max_length=120, blank=True, default="")
    guest_phone = models.CharField(max_length=30, blank=True, default="")
    delivery_address = models.TextField(blank=True, default="")
    comment = models.TextField(blank=True, default="")
    items_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    yookassa_payment_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    confirmation_url = models.URLField(blank=True, default="")
    guest_session_token = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"CafeOrder#{self.pk} {self.status}"


class CafeOrderItem(models.Model):
    order = models.ForeignKey(CafeOrder, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey(
        CafeMenuItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_lines",
    )
    name = models.CharField(max_length=180)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)])

    @property
    def line_total(self):
        return self.unit_price * self.quantity
