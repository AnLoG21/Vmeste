"""HTTP smoke: chat activity summary badges."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from chat.models import Message
from chat.services import get_or_create_client_conversation


class ChatActivityApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-chat-activity",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Activity",
        )
        self.client_user = User.objects.create_user(
            username="client-chat-activity",
            password="x",
            role=User.Role.CLIENT,
        )

    def test_activity_counts_unread_chat(self):
        conv, _ = get_or_create_client_conversation(self.provider, self.client_user)
        Message.objects.create(conversation=conv, sender=self.provider, text="Hi")
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/chat/activity/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertGreaterEqual(res.data.get("unread_chat_messages_count") or 0, 1)
        self.assertGreaterEqual(res.data.get("badge_count") or 0, 1)
        self.assertIn("notifications", res.data)
        self.assertIn("pending_staff_invites", res.data)

    def test_activity_empty_for_fresh_user(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/chat/activity/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("unread_chat_messages_count"), 0)
        self.assertEqual(res.data.get("unread_notification_count"), 0)
