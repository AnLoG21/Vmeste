import uuid

from django.conf import settings
from django.db import models


class InspectionReport(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        SENT = "sent", "Отправлен клиенту"
        APPROVED = "approved", "Утверждён"
        CANCELLED = "cancelled", "Отменён"

    class RepairStatus(models.TextChoices):
        NONE = "none", "—"
        IN_PROGRESS = "in_progress", "В работе"
        READY = "ready", "Готов"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="inspection_reports",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="client_inspection_reports",
    )
    booking = models.ForeignKey(
        "booking.Booking",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_reports",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_inspection_reports",
    )
    vehicle_title = models.CharField(max_length=200, blank=True, default="")
    vehicle_plate = models.CharField(max_length=32, blank=True, default="")
    vehicle_vin = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    repair_status = models.CharField(
        max_length=20,
        choices=RepairStatus.choices,
        default=RepairStatus.NONE,
        db_index=True,
        help_text="Статус ремонта после утверждения клиентом.",
    )
    share_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    parts_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    labor_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    repair_status_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Inspection #{self.pk} ({self.status})"


class InspectionItem(models.Model):
    class Severity(models.TextChoices):
        CRITICAL = "critical", "Критично"
        RECOMMENDED = "recommended", "Рекомендуется"
        OK = "ok", "В порядке"

    report = models.ForeignKey(
        InspectionReport,
        on_delete=models.CASCADE,
        related_name="items",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.RECOMMENDED,
    )
    parts_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    labor_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    client_selected = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    @property
    def line_total(self):
        return (self.parts_price or 0) + (self.labor_price or 0)

    def is_selectable(self) -> bool:
        return self.severity != self.Severity.OK


class InspectionItemMedia(models.Model):
    item = models.ForeignKey(
        InspectionItem,
        on_delete=models.CASCADE,
        related_name="photos",
    )
    image = models.ImageField(upload_to="inspection_photos/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
