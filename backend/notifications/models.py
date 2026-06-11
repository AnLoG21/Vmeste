from django.conf import settings
from django.db import models


class InAppNotification(models.Model):
    class Kind(models.TextChoices):
        STAFF_INVITE_ACCEPTED = "staff_invite_accepted", "Сотрудник принял приглашение"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="in_app_notifications",
    )
    kind = models.CharField(max_length=40, choices=Kind.choices)
    payload = models.JSONField(default=dict, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class SmsLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    phone = models.CharField(max_length=30)
    text = models.CharField(max_length=255)
    status = models.CharField(max_length=30, default="queued")
    created_at = models.DateTimeField(auto_now_add=True)
