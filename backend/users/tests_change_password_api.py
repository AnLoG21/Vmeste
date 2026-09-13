"""HTTP: change-password request (email confirmation path)."""

from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User


@override_settings(SKIP_EMAIL_VERIFICATION=False)
class ChangePasswordApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-change-pass",
            password="OldPass123!",
            role=User.Role.CLIENT,
            email="client-pass@example.com",
        )
        self.api.force_authenticate(self.user)

    @patch("users.views._can_send", return_value=True)
    @patch("users.views.send_password_change_email", return_value=True)
    def test_change_password_sends_email(self, mock_send, _can):
        res = self.api.post(
            "/api/users/change-password/",
            {
                "old_password": "OldPass123!",
                "new_password": "NewPass456!",
                "new_password_confirm": "NewPass456!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("почт", (res.data.get("detail") or "").lower())
        mock_send.assert_called_once()
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPass123!"))

    def test_wrong_old_password(self):
        res = self.api.post(
            "/api/users/change-password/",
            {
                "old_password": "wrong",
                "new_password": "NewPass456!",
                "new_password_confirm": "NewPass456!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)

    def test_mismatch_confirm(self):
        res = self.api.post(
            "/api/users/change-password/",
            {
                "old_password": "OldPass123!",
                "new_password": "NewPass456!",
                "new_password_confirm": "OtherPass789!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
