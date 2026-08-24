from django.conf import settings
from django.db import models
from django.utils import timezone


class SubscriptionPlan(models.Model):
    class PlanType(models.TextChoices):
        FREE = "free", "Бесплатный"
        TRIAL = "trial", "Пробный период"
        PAID = "paid", "Платный"
        CUSTOM = "custom", "Индивидуальный"

    class ProductKind(models.TextChoices):
        PLATFORM = "platform", "Платформа"
        VOICE = "voice", "Голосовой ассистент"

    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2)
    features = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    plan_type = models.CharField(
        max_length=16,
        choices=PlanType.choices,
        default=PlanType.PAID,
    )
    product_kind = models.CharField(
        max_length=16,
        choices=ProductKind.choices,
        default=ProductKind.PLATFORM,
        db_index=True,
        help_text="platform — кабинет/сотрудники; voice — минуты SpeechKit для голосового ассистента.",
    )
    voice_minutes_monthly = models.PositiveIntegerField(
        default=0,
        help_text="Минут SpeechKit в месяц для product_kind=voice (0 = не голосовой тариф).",
    )
    trial_days = models.PositiveIntegerField(
        default=0,
        help_text="Длительность пробного периода в днях (для plan_type=trial).",
    )

    @property
    def is_voice(self) -> bool:
        return self.product_kind == self.ProductKind.VOICE

    class Meta:
        ordering = ["sort_order", "price_monthly"]

    def __str__(self):
        return self.name


class UserSubscription(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает оплаты"
        ACTIVE = "active", "Активна"
        EXPIRED = "expired", "Истекла"
        CANCELLED = "cancelled", "Отменена"

    class Source(models.TextChoices):
        PAID = "paid", "Оплата"
        TRIAL = "trial", "Пробный период"
        PROMO = "promo", "Промокод"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.PAID)
    promo_code = models.CharField(max_length=64, blank=True, default="")
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    cancel_at_period_end = models.BooleanField(
        default=False,
        help_text="Подписка не продлевается; доступ сохраняется до period_end.",
    )
    reminder_3d_sent = models.BooleanField(default=False)
    reminder_1d_sent = models.BooleanField(default=False)
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_active_now(self):
        if self.status != self.Status.ACTIVE:
            return False
        if self.period_end and self.period_end < timezone.now():
            return False
        return True


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает"
        SUCCEEDED = "succeeded", "Успешно"
        CANCELLED = "cancelled", "Отменён"
        REFUNDED = "refunded", "Возврат"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    subscription = models.ForeignKey(
        UserSubscription,
        on_delete=models.CASCADE,
        related_name="payments",
        null=True,
        blank=True,
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="payments")
    yookassa_payment_id = models.CharField(max_length=64, blank=True, db_index=True)
    yookassa_refund_id = models.CharField(max_length=64, blank=True, default="")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    confirmation_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)


class PromoRedemption(models.Model):
    """Одноразовое использование промокода пользователем."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="promo_redemptions",
    )
    code = models.CharField(max_length=64, db_index=True)
    subscription = models.ForeignKey(
        UserSubscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promo_redemptions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "code"], name="uniq_user_promo_code"),
        ]

    def __str__(self):
        return f"{self.code} → user {self.user_id}"
