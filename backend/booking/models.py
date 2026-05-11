from django.conf import settings
from django.db import models


def default_staff_permissions():
    return {
        "manage_bookings": True,
        "manage_intervals": False,
        "manage_services": False,
        "manage_chats": True,
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
    slot = models.OneToOneField(AvailabilitySlot, on_delete=models.PROTECT, related_name="booking")
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_bookings",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    comment = models.CharField(max_length=250, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ProviderStaff(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_links"
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="provider_links"
    )
    display_name = models.CharField(max_length=120, blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)
    permissions = models.JSONField(blank=True, default=default_staff_permissions)

    class Meta:
        unique_together = [("provider", "staff")]
