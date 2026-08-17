from django.conf import settings
from django.db import models


def default_staff_permissions():
    return {
        "manage_bookings": True,
        "manage_intervals": False,
        "manage_services": False,
        "manage_chats": True,
        "manage_client_chats": True,
        "manage_staff": False,
        "can_delegate_permissions": False,
    }


class AvailabilitySlot(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="slots"
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_slots",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_booked = models.BooleanField(default=False)
    hold_label = models.CharField(max_length=120, blank=True, default="")
    anonymous_index = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Номер «Без сотрудников N» при staff=null.",
    )
    service_ids = models.JSONField(
        blank=True,
        default=list,
        help_text="Для «Без сотрудников»: ID услуг, которые можно оказать в этом интервале. Пусто — все услуги.",
    )
    recurrence_group = models.CharField(max_length=64, blank=True, default="")


class Booking(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        DONE = "done", "Done"

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="client_bookings"
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="provider_bookings"
    )
    service = models.ForeignKey("catalog.Service", on_delete=models.PROTECT, related_name="bookings")
    slot = models.OneToOneField(
        AvailabilitySlot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="booking",
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_bookings",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    comment = models.CharField(max_length=250, blank=True)
    selected_options = models.JSONField(
        blank=True,
        default=list,
        help_text="Снимок выбранных допов: [{id,name,price,extra_minutes}, …]",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    payment_status = models.CharField(
        max_length=20,
        default="none",
        choices=[
            ("none", "Без оплаты"),
            ("pending", "Ожидает оплату"),
            ("paid", "Оплачено"),
            ("expired", "Оплата не прошла"),
        ],
        db_index=True,
    )
    prepay_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    yookassa_payment_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    payment_url = models.URLField(blank=True, default="")
    paid_at = models.DateTimeField(null=True, blank=True)
    reminder_24h_sent = models.BooleanField(default=False)
    reminder_2h_sent = models.BooleanField(default=False)


class ProviderAcquiring(models.Model):
    class PrepayMode(models.TextChoices):
        OFF = "off", "Выключена"
        PERCENT = "percent", "Частичная"
        FULL = "full", "Полная"

    provider = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="acquiring",
    )
    payment_provider = models.CharField(
        max_length=32,
        default="yookassa",
        choices=[
            ("yookassa", "ЮKassa"),
            ("tbank", "Т‑Банк"),
            ("cloudpayments", "CloudPayments"),
            ("robokassa", "Robokassa"),
        ],
    )
    yookassa_shop_id = models.CharField(max_length=64, blank=True, default="")
    yookassa_secret_key = models.CharField(max_length=128, blank=True, default="")
    tbank_terminal_key = models.CharField(max_length=128, blank=True, default="")
    tbank_password = models.CharField(max_length=128, blank=True, default="")
    cloudpayments_public_id = models.CharField(max_length=128, blank=True, default="")
    cloudpayments_api_secret = models.CharField(max_length=128, blank=True, default="")
    robokassa_merchant_login = models.CharField(max_length=128, blank=True, default="")
    robokassa_password1 = models.CharField(max_length=128, blank=True, default="")
    robokassa_password2 = models.CharField(max_length=128, blank=True, default="")
    calendar_ics_token = models.CharField(max_length=64, blank=True, default="", db_index=True)
    prepay_mode = models.CharField(
        max_length=16,
        choices=PrepayMode.choices,
        default=PrepayMode.OFF,
    )
    prepay_percent = models.PositiveSmallIntegerField(
        default=50,
        help_text="Процент предоплаты при режиме «частичная» (1–100).",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def has_yookassa(self) -> bool:
        return bool((self.yookassa_shop_id or "").strip() and (self.yookassa_secret_key or "").strip())

    def payment_creds(self) -> dict:
        return {
            "shop_id": self.yookassa_shop_id,
            "secret_key": self.yookassa_secret_key,
            "terminal_key": self.tbank_terminal_key,
            "password": self.tbank_password,
            "public_id": self.cloudpayments_public_id,
            "api_secret": self.cloudpayments_api_secret,
            "merchant_login": self.robokassa_merchant_login,
            "password1": self.robokassa_password1,
            "password2": self.robokassa_password2,
        }

    def has_payment_keys(self) -> bool:
        from payments.gateway import provider_ready

        return provider_ready(self.payment_provider, self.payment_creds())


DEFAULT_REMINDER_TEMPLATE = (
    "Напоминание: запись в {org} на {service} — {date}. Ждём вас! Вместе"
)


class ProviderMessagingSettings(models.Model):
    provider = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="messaging_settings",
    )
    remind_clients = models.BooleanField(default=True)
    remind_org = models.BooleanField(default=True)
    notify_org_on_new = models.BooleanField(default=True)
    enable_telegram = models.BooleanField(default=False)
    enable_max = models.BooleanField(default=False)
    enable_whatsapp = models.BooleanField(default=False)
    enable_sms = models.BooleanField(default=False)
    telegram_bot_token = models.CharField(max_length=128, blank=True, default="")
    telegram_notify_chat_id = models.CharField(max_length=64, blank=True, default="")
    max_bot_token = models.CharField(max_length=128, blank=True, default="")
    max_notify_chat_id = models.CharField(max_length=64, blank=True, default="")
    wa_api_url = models.CharField(max_length=255, blank=True, default="https://api.green-api.com")
    wa_id_instance = models.CharField(max_length=64, blank=True, default="")
    wa_api_token = models.CharField(max_length=128, blank=True, default="")
    sms_api_id = models.CharField(max_length=128, blank=True, default="")
    reminder_template = models.TextField(blank=True, default="")
    telegram_org_link_token = models.CharField(max_length=64, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def reminder_text(self) -> str:
        return (self.reminder_template or "").strip() or DEFAULT_REMINDER_TEMPLATE

    def resolved_telegram_bot_token(self) -> str:
        """Org token, else platform TELEGRAM_BOT_TOKEN from .env."""
        org = (self.telegram_bot_token or "").strip()
        if org:
            return org
        from django.conf import settings as dj_settings

        return (getattr(dj_settings, "TELEGRAM_BOT_TOKEN", None) or "").strip()

    def has_telegram(self) -> bool:
        return bool(self.resolved_telegram_bot_token() and (self.telegram_notify_chat_id or "").strip())

    def has_max(self) -> bool:
        return bool((self.max_bot_token or "").strip() and (self.max_notify_chat_id or "").strip())

    def has_whatsapp(self) -> bool:
        return bool((self.wa_id_instance or "").strip() and (self.wa_api_token or "").strip())

    def has_sms_org(self) -> bool:
        return bool((self.sms_api_id or "").strip())


class ProviderStaff(models.Model):
    class InvitationStatus(models.TextChoices):
        PENDING = "pending", "Ожидает подтверждения"
        ACCEPTED = "accepted", "Принято"
        REJECTED = "rejected", "Отклонено"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_links"
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="provider_links"
    )
    display_name = models.CharField(max_length=120, blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    avatar_image = models.ImageField(
        upload_to="staff_avatars/%Y/%m/",
        null=True,
        blank=True,
    )
    bio = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    invitation_status = models.CharField(
        max_length=20,
        choices=InvitationStatus.choices,
        default=InvitationStatus.ACCEPTED,
    )
    permissions = models.JSONField(blank=True, default=default_staff_permissions)
    assigned_services = models.ManyToManyField(
        "catalog.Service", blank=True, related_name="staff_assignments"
    )
    assigned_categories = models.ManyToManyField(
        "catalog.ServiceCategory", blank=True, related_name="staff_assignments"
    )

    class Meta:
        unique_together = [("provider", "staff")]


class ProviderStaffPortfolioPhoto(models.Model):
    staff_link = models.ForeignKey(
        ProviderStaff,
        on_delete=models.CASCADE,
        related_name="portfolio_photos",
    )
    image = models.ImageField(upload_to="staff_portfolio_photos/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)
