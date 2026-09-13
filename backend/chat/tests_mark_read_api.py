"""HTTP: conversation mark-read updates last_read_message_id."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from chat.models import ConversationMember, Message
from chat.services import get_or_create_client_conversation


class ChatMarkReadApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-mark-read",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон MarkRead",
        )
        self.client_user = User.objects.create_user(
            username="client-mark-read",
            password="x",
            role=User.Role.CLIENT,
        )
        self.conv, _ = get_or_create_client_conversation(self.provider, self.client_user)
        self.msg1 = Message.objects.create(conversation=self.conv, sender=self.provider, text="раз")
        self.msg2 = Message.objects.create(conversation=self.conv, sender=self.provider, text="два")
        self.api.force_authenticate(self.client_user)

    def test_mark_read_latest(self):
        res = self.api.post(f"/api/chat/conversations/{self.conv.id}/mark-read/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("ok"))
        self.assertEqual(res.data.get("last_read_message_id"), self.msg2.id)
        mem = ConversationMember.objects.get(conversation=self.conv, user=self.client_user)
        self.assertEqual(mem.last_read_message_id, self.msg2.id)

    def test_mark_read_specific_message(self):
        res = self.api.post(
            f"/api/chat/conversations/{self.conv.id}/mark-read/",
            {"message_id": self.msg1.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("last_read_message_id"), self.msg1.id)

    def test_mark_read_non_member_404(self):
        stranger = User.objects.create_user(
            username="stranger-mark-read",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(stranger)
        res = self.api.post(f"/api/chat/conversations/{self.conv.id}/mark-read/", {}, format="json")
        self.assertEqual(res.status_code, 404)
