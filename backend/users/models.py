from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        CLIENT = "client", "Клиент"
        PROVIDER = "provider", "Исполнитель"
        STAFF = "staff", "Сотрудник"

    class ProviderSphere(models.TextChoices):
        HAIR_SALON = "hair_salon", "Салон красоты"
        SERVICE_CENTER = "service_center", "Сервисный центр"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CLIENT)
    phone = models.CharField(max_length=30, blank=True)
    patronymic = models.CharField(max_length=150, blank=True)
    email_verification_token = models.CharField(max_length=64, blank=True)
    email_verified = models.BooleanField(default=False)
    organization_name = models.CharField(max_length=180, blank=True)
    organization_address = models.TextField(blank=True, default="")
    organization_entrance = models.CharField(max_length=32, blank=True, default="")
    organization_floor = models.CharField(max_length=32, blank=True, default="")
    organization_apartment = models.CharField(max_length=64, blank=True, default="")
    organization_intercom = models.CharField(max_length=64, blank=True, default="")
    organization_address_extra = models.CharField(max_length=255, blank=True, default="")
    organization_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    organization_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    provider_sphere = models.CharField(
        max_length=30, choices=ProviderSphere.choices, blank=True
    )
    last_seen_at = models.DateTimeField(null=True, blank=True)
    booking_confirm_message_default = models.TextField(
        blank=True,
        default="",
        help_text="Сообщение клиенту при подтверждении записи.",
    )
    booking_cancel_message_default = models.TextField(
        blank=True,
        default="",
        help_text="Сообщение клиенту при отмене записи организацией.",
    )
    booking_done_message_default = models.TextField(
        blank=True,
        default="",
        help_text="Сообщение клиенту при отметке «услуга оказана».",
    )
