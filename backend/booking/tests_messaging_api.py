"""HTTP: provider messaging settings + org telegram link."""

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User

from notifications.delivery import get_or_create_messaging


@override_settings(TELEGRAM_BOT_USERNAME="vmeste_org_bot")
class MessagingSettingsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-messaging-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Messaging",
        )
        self.client_user = User.objects.create_user(
            username="client-messaging-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(self.provider)

    def test_get_messaging(self):
        res = self.api.get("/api/booking/messaging/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("enable_telegram", res.data)
        self.assertIn("remind_clients", res.data)

    def test_patch_enable_telegram(self):
        res = self.api.patch(
            "/api/booking/messaging/",
            {
                "enable_telegram": True,
                "telegram_notify_chat_id": "999001",
                "remind_clients": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["enable_telegram"])
        self.assertEqual(res.data["telegram_notify_chat_id"], "999001")
        msg = get_or_create_messaging(self.provider)
        self.assertTrue(msg.enable_telegram)
        self.assertEqual(msg.telegram_notify_chat_id, "999001")

    def test_client_forbidden(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/booking/messaging/")
        self.assertEqual(res.status_code, 403)

    def test_org_telegram_link_get_and_delete(self):
        msg = get_or_create_messaging(self.provider)
        msg.telegram_notify_chat_id = "555"
        msg.save(update_fields=["telegram_notify_chat_id"])

        res = self.api.get("/api/booking/messaging/telegram-link/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("link_token"))
        self.assertTrue(res.data.get("linked"))
        self.assertIn("t.me/vmeste_org_bot?start=org_", res.data.get("deep_link") or "")

        deleted = self.api.delete("/api/booking/messaging/telegram-link/")
        self.assertEqual(deleted.status_code, 200, deleted.data)
        self.assertFalse(deleted.data.get("linked"))
        msg.refresh_from_db()
        self.assertEqual(msg.telegram_notify_chat_id, "")
