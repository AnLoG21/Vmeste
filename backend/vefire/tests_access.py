from django.contrib.auth import get_user_model
from django.test import SimpleTestCase

from vefire.access import user_can_vefire

User = get_user_model()


class VefireAccessTests(SimpleTestCase):
    def test_allowlist(self):
        u = User(username="a.loginov150")
        u.is_authenticated = True  # type: ignore[attr-defined]
        self.assertTrue(user_can_vefire(u))

        other = User(username="someone")
        other.is_authenticated = True  # type: ignore[attr-defined]
        self.assertFalse(user_can_vefire(other))
