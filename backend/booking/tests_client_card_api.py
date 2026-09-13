"""HTTP: provider client memory card GET/PATCH."""

from django.test import TestCase
from rest_framework.test import APIClient

from booking.models import ProviderClientCard
from booking.phone_clients import touch_provider_client_card
from users.models import User


class ClientCardApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-client-card",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Card",
        )
        self.client_user = User.objects.create_user(
            username="client-card-user",
            password="x",
            role=User.Role.CLIENT,
            first_name="Ирина",
            last_name="Карта",
            phone="+79006667788",
        )
        touch_provider_client_card(self.provider.id, self.client_user)
        self.api.force_authenticate(self.provider)

    def test_get_and_patch_card(self):
        got = self.api.get(f"/api/booking/client-cards/?client={self.client_user.id}")
        self.assertEqual(got.status_code, 200, got.data)
        self.assertEqual(got.data.get("client"), self.client_user.id)
        self.assertIn("tech", got.data)
        self.assertIn("personal", got.data)

        patched = self.api.patch(
            f"/api/booking/client-cards/?client={self.client_user.id}",
            {
                "tech": {"hair_color": "7.1 + оксид 3%"},
                "preferences_notes": "Любит тишину",
                "acquisition_source": "Instagram",
                "is_blocked": False,
            },
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertEqual(patched.data.get("tech", {}).get("hair_color"), "7.1 + оксид 3%")
        self.assertEqual(patched.data.get("preferences_notes"), "Любит тишину")
        self.assertEqual(patched.data.get("acquisition_source"), "Instagram")

        card = ProviderClientCard.objects.get(provider=self.provider, client=self.client_user)
        self.assertEqual(card.tech.get("hair_color"), "7.1 + оксид 3%")
        self.assertEqual(card.preferences_notes, "Любит тишину")

    def test_block_and_field_prefs(self):
        blocked = self.api.patch(
            f"/api/booking/client-cards/?client={self.client_user.id}",
            {"is_blocked": True},
            format="json",
        )
        self.assertEqual(blocked.status_code, 200, blocked.data)
        self.assertTrue(blocked.data.get("is_blocked"))
        card = ProviderClientCard.objects.get(provider=self.provider, client=self.client_user)
        self.assertTrue(card.is_blocked)

        prefs = self.api.patch(
            f"/api/booking/client-cards/?client={self.client_user.id}",
            {"field_prefs": {"hair_color": False, "technical_notes": True}},
            format="json",
        )
        self.assertEqual(prefs.status_code, 200, prefs.data)
        field_prefs = prefs.data.get("field_prefs") or {}
        self.assertFalse(field_prefs.get("hair_color"))
        self.assertTrue(field_prefs.get("technical_notes"))

    def test_client_forbidden(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get(f"/api/booking/client-cards/?client={self.client_user.id}")
        self.assertEqual(res.status_code, 403)
