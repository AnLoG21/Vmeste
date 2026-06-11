from django.conf import settings
from django.db import models
from django.utils import timezone


class SubscriptionPlan(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2)
    features = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

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

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    cancel_at_period_end = models.BooleanField(
        default=False,
        help_text="Подписка не продлевается; доступ сохраняется до period_end.",
    )
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
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    confirmation_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
