from django.conf import settings
from django.db import models


class Conversation(models.Model):
    title = models.CharField(max_length=150, blank=True)
    is_group = models.BooleanField(default=False)
    is_saved_messages = models.BooleanField(default=False)
    is_client_correspondence = models.BooleanField(default=False)
    organization = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="organization_conversations",
        help_text="Исполнитель-владелец организации (внутренние чаты с сотрудниками).",
    )
    created_at = models.DateTimeField(auto_now_add=True)


class ConversationMember(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations"
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_message_id = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        unique_together = [("conversation", "user")]


class Message(models.Model):
    class Kind(models.TextChoices):
        TEXT = "text", "Text"
        REVIEW_REPLY = "review_reply", "Review reply"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        FILE = "file", "File"
        VOICE = "voice", "Voice"
        VIDEO_NOTE = "video_note", "Video note"
        LINK = "link", "Link"

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.TEXT)
    payload = models.JSONField(default=dict, blank=True)
    text = models.TextField(blank=True, default="")
    attachment = models.FileField(upload_to="chat/%Y/%m/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
