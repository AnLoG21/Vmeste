"""HTTP: provider calendar ICS settings GET + token rotate."""

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User

from booking.acquiring import ensure_calendar_token, get_or_create_acquiring


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class CalendarSettingsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-calendar-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Calendar",
        )
        self.client_user = User.objects.create_user(
            username="client-calendar-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(self.provider)

    def test_get_calendar_urls(self):
        res = self.api.get("/api/booking/calendar/settings/")
        self.assertEqual(res.status_code, 200, res.data)
        token = ensure_calendar_token(self.provider)
        self.assertIn(token, res.data.get("ics_url") or "")
        self.assertTrue((res.data.get("ics_url") or "").endswith(".ics"))
        self.assertIn("webcal://", res.data.get("webcal_url") or "")
        self.assertIn("calendar.google.com", res.data.get("google_url") or "")

    def test_rotate_token_changes_url(self):
        before = ensure_calendar_token(self.provider)
        res = self.api.post("/api/booking/calendar/settings/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        after = get_or_create_acquiring(self.provider).calendar_ics_token
        self.assertNotEqual(before, after)
        self.assertIn(after, res.data.get("ics_url") or "")

    def test_client_forbidden(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/booking/calendar/settings/")
        self.assertEqual(res.status_code, 403)
