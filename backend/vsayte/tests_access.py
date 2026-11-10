from django.contrib.auth import get_user_model
from django.test import TestCase

from vsayte.access import user_has_full_vsayte_access
from vsayte.entitlement import PRO_SLUG, current_limits


User = get_user_model()


class VsayteAccessTests(TestCase):
    def test_full_access_allowlist(self):
        u = User(username="a.loginov150")
        self.assertTrue(user_has_full_vsayte_access(u))
        other = User(username="someone")
        self.assertFalse(user_has_full_vsayte_access(other))

    def test_limits_for_allowlisted_user(self):
        user = User.objects.create_user(username="a.loginov150", email="a@test.local", password="x")
        limits = current_limits(user)
        self.assertEqual(limits["plan_slug"], PRO_SLUG)
        self.assertTrue(limits["can_publish"])
        self.assertTrue(limits["can_custom_domain"])
        self.assertEqual(limits["editor_tier"], "pro")
        self.assertTrue(limits["full_access"])
