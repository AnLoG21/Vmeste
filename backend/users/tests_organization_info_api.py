"""HTTP: PATCH /users/organization-info/ working hours + contacts."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User
from users.org_profile import default_working_hours


class OrganizationInfoApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-org-info",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Info",
        )
        self.api.force_authenticate(self.provider)

    def test_patch_working_hours_and_phones(self):
        hours = default_working_hours()
        hours["sun"] = {"open": "10:00", "close": "16:00", "closed": True}
        hours["mon"] = {"open": "10:00", "close": "20:00", "closed": False}
        res = self.api.patch(
            "/api/users/organization-info/",
            {
                "organization_working_hours": hours,
                "organization_phones": ["+79001112233", ""],
                "organization_websites": ["https://example.ru"],
                "organization_card_note": "Парковка во дворе",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.provider.refresh_from_db()
        self.assertTrue(self.provider.organization_working_hours["sun"]["closed"])
        self.assertEqual(self.provider.organization_working_hours["mon"]["open"], "10:00")
        self.assertEqual(self.provider.organization_phones, ["+79001112233"])
        self.assertEqual(self.provider.organization_websites, ["https://example.ru"])
        self.assertEqual(self.provider.organization_card_note, "Парковка во дворе")

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-org-info",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.patch(
            "/api/users/organization-info/",
            {"organization_card_note": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_empty_patch_rejected(self):
        res = self.api.patch("/api/users/organization-info/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
