"""HTTP: client PATCH /users/me/ notify prefs."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User


class NotifyPrefsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-notify-prefs",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(self.user)

    def test_patch_notify_prefs(self):
        res = self.api.patch(
            "/api/users/me/",
            {
                "notify_booking_reminders": False,
                "notify_booking_status": False,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data.get("notify_booking_reminders"))
        self.assertFalse(res.data.get("notify_booking_status"))
        self.user.refresh_from_db()
        self.assertFalse(self.user.notify_booking_reminders)
        self.assertFalse(self.user.notify_booking_status)

    def test_patch_reenable_reminders(self):
        self.user.notify_booking_reminders = False
        self.user.save(update_fields=["notify_booking_reminders"])
        res = self.api.patch(
            "/api/users/me/",
            {"notify_booking_reminders": True},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("notify_booking_reminders"))
