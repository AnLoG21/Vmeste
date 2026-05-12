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
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages"
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
