from django.conf import settings
from django.db import models


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
