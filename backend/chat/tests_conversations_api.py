"""HTTP smoke: conversations list (saved messages), create-with-provider, post message."""

from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from chat.models import Conversation, Message


class ChatConversationsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-chat-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Chat",
        )
        self.client_user = User.objects.create_user(
            username="client-chat-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(self.client_user)

    def test_list_creates_saved_messages(self):
        res = self.api.get("/api/chat/conversations/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(any(c.get("is_saved_messages") for c in res.data))
        self.assertTrue(
            Conversation.objects.filter(
                members__user=self.client_user,
                is_saved_messages=True,
            ).exists()
        )

    def test_create_with_provider(self):
        res = self.api.post(
            "/api/chat/conversations/create-with-provider/",
            {"provider_id": self.provider.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("is_client_correspondence"))
        self.assertEqual(res.data.get("organization"), self.provider.id)

    def test_post_and_list_messages(self):
        create = self.api.post(
            "/api/chat/conversations/create-with-provider/",
            {"provider_id": self.provider.id},
            format="json",
        )
        self.assertEqual(create.status_code, 200, create.data)
        conv_id = create.data["id"]
        with patch("notifications.push.notify_users"):
            post = self.api.post(
                "/api/chat/messages/",
                {"conversation": conv_id, "text": "Привет"},
                format="json",
            )
        self.assertEqual(post.status_code, 201, post.data)
        self.assertEqual(post.data.get("text"), "Привет")
        self.assertEqual(Message.objects.filter(conversation_id=conv_id).count(), 1)

        listed = self.api.get(f"/api/chat/messages/?conversation={conv_id}")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0]["text"], "Привет")
