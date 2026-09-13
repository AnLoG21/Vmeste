"""HTTP: verify-email + resend-verification."""

from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User


@override_settings(SKIP_EMAIL_VERIFICATION=False)
class EmailVerificationApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-verify-email",
            password="x",
            role=User.Role.CLIENT,
            email="verify-me@example.com",
            email_verified=False,
            email_verification_token="e2e-verify-token",
        )

    def test_verify_email_ok(self):
        res = self.api.post(
            "/api/users/verify-email/",
            {"token": "e2e-verify-token"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        self.assertEqual(self.user.email_verification_token, "")

    def test_verify_email_bad_token(self):
        res = self.api.post(
            "/api/users/verify-email/",
            {"token": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    @patch("users.views.send_verification_email", return_value=True)
    def test_resend_verification(self, mock_send):
        res = self.api.post(
            "/api/users/resend-verification/",
            {"email": "verify-me@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("письм", (res.data.get("detail") or "").lower())
        mock_send.assert_called_once()
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verification_token)
        self.assertNotEqual(self.user.email_verification_token, "e2e-verify-token")

    def test_resend_already_verified(self):
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])
        res = self.api.post(
            "/api/users/resend-verification/",
            {"email": "verify-me@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("подтвержд", (res.data.get("detail") or "").lower())
