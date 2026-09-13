"""HTTP: request + confirm password reset."""

from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.email_service import make_password_reset_token
from users.models import User


@override_settings(SKIP_EMAIL_VERIFICATION=False)
class PasswordResetApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-reset-pass",
            password="OldPass123!",
            role=User.Role.CLIENT,
            email="reset-pass@example.com",
        )

    @patch("users.views._can_send", return_value=True)
    @patch("users.views.send_password_reset_email", return_value=True)
    def test_request_reset_authenticated(self, mock_send, _can):
        self.api.force_authenticate(self.user)
        res = self.api.post("/api/users/request-password-reset/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("ссылк", (res.data.get("detail") or "").lower())
        mock_send.assert_called_once()

    @patch("users.views._can_send", return_value=True)
    @patch("users.views.send_password_reset_email", return_value=True)
    def test_request_reset_by_email_anonymous(self, mock_send, _can):
        res = self.api.post(
            "/api/users/request-password-reset/",
            {"email": "reset-pass@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("отправили", (res.data.get("detail") or "").lower())
        mock_send.assert_called_once()

    @patch("users.views._can_send", return_value=True)
    @patch("users.views.send_password_reset_email", return_value=True)
    def test_request_reset_unknown_email_still_ok(self, mock_send, _can):
        res = self.api.post(
            "/api/users/request-password-reset/",
            {"email": "nobody@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        mock_send.assert_not_called()

    def test_confirm_reset_sets_password(self):
        token = make_password_reset_token(self.user)
        res = self.api.post(
            "/api/users/confirm-password-reset/",
            {
                "token": token,
                "new_password": "NewPass456!",
                "new_password_confirm": "NewPass456!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass456!"))
        self.assertFalse(self.user.check_password("OldPass123!"))

    def test_confirm_mismatch(self):
        token = make_password_reset_token(self.user)
        res = self.api.post(
            "/api/users/confirm-password-reset/",
            {
                "token": token,
                "new_password": "NewPass456!",
                "new_password_confirm": "OtherPass789!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPass123!"))

    def test_confirm_bad_token(self):
        res = self.api.post(
            "/api/users/confirm-password-reset/",
            {
                "token": "bad-token",
                "new_password": "NewPass456!",
                "new_password_confirm": "NewPass456!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
