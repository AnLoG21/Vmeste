from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from vmagnitol.access import user_can_vmagnitol
from vmagnitol.models import Brand


User = get_user_model()


class VmagnitolAccessTests(TestCase):
    def test_allowlist(self):
        self.assertTrue(user_can_vmagnitol(User(username="a.loginov150")))
        self.assertFalse(user_can_vmagnitol(User(username="someone")))
        self.assertFalse(user_can_vmagnitol(None))

    def test_api_denied_for_strangers(self):
        user = User.objects.create_user(username="other", email="o@test.local", password="pass12345")
        client = APIClient()
        client.force_authenticate(user)
        res = client.get("/api/vmagnitol/brands/")
        self.assertEqual(res.status_code, 403)

    def test_api_ok_for_allowlist(self):
        user = User.objects.create_user(
            username="a.loginov150",
            email="a@test.local",
            password="pass12345",
        )
        Brand.objects.create(name="Geely", slug="geely")
        client = APIClient()
        client.force_authenticate(user)
        res = client.get("/api/vmagnitol/brands/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["slug"], "geely")
