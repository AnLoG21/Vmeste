"""HTTP: in-app notification mark-read + push token register."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from notifications.models import DevicePushToken, InAppNotification


class InAppNotificationsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-notif-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.other = User.objects.create_user(
            username="other-notif-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.note = InAppNotification.objects.create(
            user=self.user,
            kind=InAppNotification.Kind.BOOKING,
            payload={"title": "Запись", "body": "Подтверждена", "when": "завтра"},
            read=False,
        )
        self.api.force_authenticate(self.user)

    def test_mark_read(self):
        res = self.api.post(
            "/api/notifications/in-app/mark-read/",
            {"ids": [self.note.id]},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("ok"))
        self.note.refresh_from_db()
        self.assertTrue(self.note.read)

    def test_mark_read_requires_ids(self):
        res = self.api.post("/api/notifications/in-app/mark-read/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)

    def test_mark_read_ignores_foreign_ids(self):
        foreign = InAppNotification.objects.create(
            user=self.other,
            kind=InAppNotification.Kind.REVIEW,
            payload={"body": "x"},
        )
        res = self.api.post(
            "/api/notifications/in-app/mark-read/",
            {"ids": [foreign.id]},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        foreign.refresh_from_db()
        self.assertFalse(foreign.read)

    def test_register_push_token(self):
        token = "a" * 40
        res = self.api.post(
            "/api/notifications/push/register/",
            {"token": token, "platform": "android"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("ok"))
        self.assertEqual(DevicePushToken.objects.filter(user=self.user, token=token).count(), 1)

    def test_register_push_token_rejects_short(self):
        res = self.api.post(
            "/api/notifications/push/register/",
            {"token": "short", "platform": "android"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
