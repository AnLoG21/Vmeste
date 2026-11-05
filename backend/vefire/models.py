from django.conf import settings
from django.db import models


class CastRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_CLAIMED = "claimed"
    STATUS_DONE = "done"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_CLAIMED, "Claimed"),
        (STATUS_DONE, "Done"),
        (STATUS_FAILED, "Failed"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vefire_casts")
    url = models.URLField(max_length=2000)
    title = models.CharField(max_length=200, blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    error = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Cast#{self.pk} {self.status} {self.url[:60]}"


class AgentHeartbeat(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vefire_agent"
    )
    remote_url = models.URLField(max_length=500, blank=True, default="")
    ips = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_jpeg = models.BinaryField(null=True, blank=True)
    frame_width = models.PositiveIntegerField(default=1280)
    frame_height = models.PositiveIntegerField(default=720)
    frame_updated_at = models.DateTimeField(null=True, blank=True)
    input_queue = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"Agent<{self.user_id}> {self.remote_url}"


