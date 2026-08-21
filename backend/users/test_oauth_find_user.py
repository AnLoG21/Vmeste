"""OAuth user match: only by social id; no email merge; no client→provider upgrade."""

from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase

from users.oauth import _find_or_create_oauth_user

User = get_user_model()


class FindOrCreateOAuthUserTests(TestCase):
    def setUp(self):
        self.request = RequestFactory().get("/")

    def test_matches_by_vk_id_not_email(self):
        other = User.objects.create_user(
            username="other",
            email="shared@example.com",
            password="pass12345",
            role=User.Role.PROVIDER,
            first_name="Чужой",
            last_name="Кабинет",
        )

        user = _find_or_create_oauth_user(
            request=self.request,
            id_field="vk_id",
            oauth_id="999001",
            email="shared@example.com",
            first_name="Иван",
            last_name="Клиент",
            phone="",
            username_hint="vk_999001",
            role="client",
        )
        self.assertNotEqual(user.pk, other.pk)
        self.assertEqual(user.role, User.Role.CLIENT)
        self.assertEqual(user.vk_id, "999001")
        self.assertEqual(user.email, "")  # email занят — не копируем
        other.refresh_from_db()
        self.assertEqual(other.vk_id, "")

    def test_does_not_upgrade_client_to_provider(self):
        existing = User(
            username="vk_111",
            email="a@example.com",
            role=User.Role.CLIENT,
            first_name="A",
            last_name="B",
            vk_id="111",
        )
        existing.set_unusable_password()
        existing.save()

        user = _find_or_create_oauth_user(
            request=self.request,
            id_field="vk_id",
            oauth_id="111",
            email="a@example.com",
            first_name="A",
            last_name="B",
            phone="",
            username_hint="vk_111",
            role="provider",
        )
        self.assertEqual(user.pk, existing.pk)
        self.assertEqual(user.role, User.Role.CLIENT)

    def test_creates_provider_only_when_new_and_role_provider(self):
        user = _find_or_create_oauth_user(
            request=self.request,
            id_field="yandex_id",
            oauth_id="ya42",
            email="newbiz@example.com",
            first_name="Biz",
            last_name="Owner",
            phone="",
            username_hint="ya_ya42",
            role="provider",
        )
        self.assertEqual(user.role, User.Role.PROVIDER)
        self.assertEqual(user.yandex_id, "ya42")

    def test_creates_client_by_default(self):
        user = _find_or_create_oauth_user(
            request=self.request,
            id_field="yandex_id",
            oauth_id="ya99",
            email="client@example.com",
            first_name="Cli",
            last_name="Ent",
            phone="",
            username_hint="ya_ya99",
            role="",
        )
        self.assertEqual(user.role, User.Role.CLIENT)
