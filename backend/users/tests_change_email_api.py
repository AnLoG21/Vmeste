"""HTTP: change-email request (verification email path)."""

from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User


@override_settings(SKIP_EMAIL_VERIFICATION=False)
class ChangeEmailApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-change-email",
            password="x",
            role=User.Role.CLIENT,
            email="old@example.com",
            email_verified=True,
        )
        self.api.force_authenticate(self.user)

    @patch("users.views._can_send", return_value=True)
    @patch("users.views.send_email_change_email", return_value=True)
    def test_change_email_sends_verification(self, mock_send, _can):
        res = self.api.post(
            "/api/users/change-email/",
            {"new_email": "new@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("email", (res.data.get("detail") or "").lower())
        mock_send.assert_called_once()
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "new@example.com")
        self.assertFalse(self.user.email_verified)
        self.assertTrue(self.user.email_verification_token)

    def test_duplicate_email_rejected(self):
        User.objects.create_user(
            username="other-email-user",
            password="x",
            role=User.Role.CLIENT,
            email="taken@example.com",
        )
        res = self.api.post(
            "/api/users/change-email/",
            {"new_email": "taken@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "old@example.com")

    def test_invalid_email(self):
        res = self.api.post(
            "/api/users/change-email/",
            {"new_email": "not-an-email"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
