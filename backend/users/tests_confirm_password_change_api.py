"""HTTP: confirm-password-change via signed token."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.email_service import make_password_change_token
from users.models import User


class ConfirmPasswordChangeApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-confirm-pass",
            password="OldPass123!",
            role=User.Role.CLIENT,
            email="confirm-pass@example.com",
        )

    def test_confirm_sets_new_password(self):
        token = make_password_change_token(self.user, "NewPass456!")
        res = self.api.post(
            "/api/users/confirm-password-change/",
            {"token": token},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("изменён", (res.data.get("detail") or "").lower())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass456!"))
        self.assertFalse(self.user.check_password("OldPass123!"))

    def test_missing_token(self):
        res = self.api.post("/api/users/confirm-password-change/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)

    def test_bad_token(self):
        res = self.api.post(
            "/api/users/confirm-password-change/",
            {"token": "not-a-valid-token"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPass123!"))
