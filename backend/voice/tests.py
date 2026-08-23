from datetime import datetime, timedelta

from django.test import TestCase
from django.utils import timezone

from booking.models import AvailabilitySlot, ProviderStaff
from catalog.models import Service
from users.models import User

from .booking_adapter import match_service, parse_relative_date
from .models import ProviderVoiceSettings, VoiceCallSession
from .orchestrator import process_turn
from .telephony import normalize_inbound


class VoiceTelephonyTests(TestCase):
    def test_mango_normalize(self):
        ev = normalize_inbound(
            {"json": {"call_id": "abc", "from": "+79001234567", "to": "+7495", "call_state": "Connected"}},
            ats="mango",
        )
        self.assertEqual(ev["call_id"], "abc")
        self.assertIn("9001234567", ev["caller_phone"])


class VoiceBookingAdapterTests(TestCase):
    def setUp(self):
        self.provider = User.objects.create_user(
            username="salon1",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Лена",
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Маникюр классический",
            duration_minutes=60,
            price=1500,
            is_active=True,
        )

    def test_match_service_synonym(self):
        hit = match_service(self.provider.id, "ноготочки")
        self.assertIsNotNone(hit)
        self.assertEqual(hit["id"], self.service.id)

    def test_parse_relative_date(self):
        today = timezone.localdate()
        self.assertEqual(parse_relative_date("завтра", today), today + timedelta(days=1))


class VoiceOrchestratorTests(TestCase):
    def setUp(self):
        self.provider = User.objects.create_user(
            username="salon2",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Beauty",
        )
        self.master = User.objects.create_user(
            username="lena",
            password="x",
            role=User.Role.STAFF,
            first_name="Лена",
        )
        ProviderStaff.objects.create(
            provider=self.provider,
            staff=self.master,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Маникюр",
            duration_minutes=60,
            price=1200,
            is_active=True,
        )
        tomorrow = timezone.localdate() + timedelta(days=1)
        start = timezone.make_aware(
            datetime.combine(tomorrow, datetime.min.time().replace(hour=10)),
            timezone.get_current_timezone(),
        )
        AvailabilitySlot.objects.create(
            provider=self.provider,
            staff=self.master,
            starts_at=start,
            ends_at=start + timedelta(hours=8),
            is_booked=False,
        )
        self.voice = ProviderVoiceSettings.objects.create(provider=self.provider, enabled=True)

    def test_greeting_on_empty_turn(self):
        session = VoiceCallSession.objects.create(provider=self.provider, caller_phone="+79001112233")
        out = process_turn(session, "", greeting="Привет!")
        self.assertIn("Привет", out["say"])
        self.assertEqual(out["action"], "continue")

    def test_webhook_token_required(self):
        from rest_framework.test import APIClient

        client = APIClient()
        res = client.post("/api/voice/webhook/inbound/", {"event": "incoming"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_simulate_call(self):
        from rest_framework.test import APIClient

        client = APIClient()
        res = client.post(
            "/api/voice/simulate/",
            {"caller_phone": "+79001112233"},
            format="json",
            HTTP_X_VOICE_TOKEN=self.voice.webhook_token,
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data.get("say"))
