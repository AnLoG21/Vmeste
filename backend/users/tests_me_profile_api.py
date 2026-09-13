"""HTTP: PATCH /users/me/ personal profile fields."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User


class MeProfileApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-profile-api",
            password="x",
            role=User.Role.CLIENT,
            email="profile@example.com",
            first_name="Старое",
            last_name="Имя",
            phone="+79001112233",
        )
        self.api.force_authenticate(self.user)

    def test_patch_profile_fields(self):
        res = self.api.patch(
            "/api/users/me/",
            {
                "first_name": "Иван",
                "last_name": "Иванов",
                "patronymic": "Иванович",
                "phone": "+79005556677",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("first_name"), "Иван")
        self.assertEqual(res.data.get("last_name"), "Иванов")
        self.assertEqual(res.data.get("patronymic"), "Иванович")
        self.assertEqual(res.data.get("phone"), "+79005556677")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Иван")
        self.assertEqual(self.user.last_name, "Иванов")
        self.assertEqual(self.user.phone, "+79005556677")

    def test_patch_partial_name(self):
        res = self.api.patch(
            "/api/users/me/",
            {"first_name": "Пётр"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("first_name"), "Пётр")
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_name, "Имя")
