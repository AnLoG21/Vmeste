"""HTTP: POST /users/me/delete/ anonymize + deactivate."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User


class DeleteAccountApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-delete-api",
            password="DeleteMe123!",
            role=User.Role.CLIENT,
            email="delete-me@example.com",
            first_name="Куда",
            last_name="Удалить",
            phone="+79001110000",
        )
        self.api.force_authenticate(self.user)

    def test_delete_anonymizes_account(self):
        uid = self.user.id
        res = self.api.post(
            "/api/users/me/delete/",
            {"password": "DeleteMe123!", "confirm": "удалить"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("удалён", (res.data.get("detail") or "").lower())
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertEqual(self.user.username, f"deleted_{uid}")
        self.assertEqual(self.user.email, f"deleted_{uid}@deleted.local")
        self.assertEqual(self.user.first_name, "Удалён")
        self.assertEqual(self.user.phone, "")
        self.assertFalse(self.user.has_usable_password())
        self.assertIsNotNone(self.user.account_deleted_at)

    def test_wrong_password(self):
        res = self.api.post(
            "/api/users/me/delete/",
            {"password": "wrong", "confirm": "удалить"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_missing_confirm_word(self):
        res = self.api.post(
            "/api/users/me/delete/",
            {"password": "DeleteMe123!", "confirm": "нет"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
