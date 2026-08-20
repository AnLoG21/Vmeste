"""OAuth credentials setup and provisional usernames."""

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from users.views import SetupCredentialsView

User = get_user_model()


class ProvisionalUsernameTests(SimpleTestCase):
    def test_vk_style_is_provisional(self):
        u = User(username="vk_463381702")
        self.assertTrue(u.username_is_provisional())
        self.assertTrue(u.needs_credentials_setup())

    def test_normal_login_with_password_ok(self):
        u = User(username="ivan")
        u.set_password("secret-pass-99")
        self.assertFalse(u.username_is_provisional())
        self.assertFalse(u.needs_credentials_setup())


class SetupCredentialsApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User(
            username="vk_463381702",
            email="",
            role=User.Role.CLIENT,
            first_name="Иван",
            last_name="Тестов",
        )
        self.user.set_unusable_password()
        self.user.save()

    def test_setup_credentials(self):
        req = self.factory.post(
            "/api/users/me/setup-credentials/",
            {"username": "ivan_test", "password": "StrongPass99", "password_confirm": "StrongPass99"},
            format="json",
        )
        force_authenticate(req, user=self.user)
        resp = SetupCredentialsView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "ivan_test")
        self.assertTrue(self.user.has_usable_password())
        self.assertTrue(self.user.check_password("StrongPass99"))
        self.assertFalse(self.user.needs_credentials_setup())
        self.assertFalse(resp.data.get("needs_credentials_setup"))

    def test_rejects_provisional_username(self):
        req = self.factory.post(
            "/api/users/me/setup-credentials/",
            {"username": "vk_111", "password": "StrongPass99", "password_confirm": "StrongPass99"},
            format="json",
        )
        force_authenticate(req, user=self.user)
        resp = SetupCredentialsView.as_view()(req)
        self.assertEqual(resp.status_code, 400)
