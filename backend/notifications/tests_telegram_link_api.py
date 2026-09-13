"""HTTP: client Telegram link token GET/DELETE."""

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User


@override_settings(TELEGRAM_BOT_USERNAME="vmeste_test_bot")
class TelegramLinkApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-tg-link",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(self.user)

    def test_get_creates_token_and_deep_link(self):
        res = self.api.get("/api/notifications/telegram/link/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("link_token"))
        self.assertFalse(res.data.get("linked"))
        self.assertIn("t.me/vmeste_test_bot?start=", res.data.get("deep_link") or "")
        self.user.refresh_from_db()
        self.assertEqual(self.user.telegram_link_token, res.data["link_token"])

    def test_get_is_idempotent_for_token(self):
        first = self.api.get("/api/notifications/telegram/link/")
        second = self.api.get("/api/notifications/telegram/link/")
        self.assertEqual(first.data["link_token"], second.data["link_token"])

    def test_delete_unlinks_chat_id(self):
        self.user.telegram_chat_id = "12345"
        self.user.telegram_link_token = "tok"
        self.user.save(update_fields=["telegram_chat_id", "telegram_link_token"])
        res = self.api.delete("/api/notifications/telegram/link/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data.get("linked"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.telegram_chat_id, "")
