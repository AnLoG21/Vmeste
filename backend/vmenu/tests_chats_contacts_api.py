"""HTTP: Вменю chats/contacts (followers without active DM)."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User
from vmenu.models import VmenuFollow


class VmenuChatsContactsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.me = User.objects.create_user(
            username="vmenu-chat-me",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-chat-me@example.com",
        )
        self.follower = User.objects.create_user(
            username="vmenu-chat-follower",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-chat-follower@example.com",
            first_name="Подписчик",
        )
        VmenuFollow.objects.create(follower=self.follower, following=self.me)
        self.api.force_authenticate(self.me)

    def test_contacts_lists_followers(self):
        res = self.api.get("/api/vmenu/chats/contacts/")
        self.assertEqual(res.status_code, 200, res.data)
        followers = res.data.get("followers") or []
        ids = [f.get("id") for f in followers]
        self.assertIn(self.follower.id, ids)

    def test_contacts_requires_auth(self):
        self.api.force_authenticate(None)
        res = self.api.get("/api/vmenu/chats/contacts/")
        self.assertIn(res.status_code, (401, 403))
