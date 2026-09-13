"""HTTP: provider manual-hold / release-hold on availability slots."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import AvailabilitySlot
from users.models import User


class ManualHoldApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-hold-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Hold",
            anonymous_seat_count=1,
        )
        start = timezone.now().replace(minute=0, second=0, microsecond=0) + timedelta(days=1)
        start = start.replace(hour=9)
        self.container = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(hours=8),
            is_booked=False,
            anonymous_index=1,
            service_ids=[],
        )
        self.api.force_authenticate(self.provider)

    def test_manual_hold_and_release(self):
        hold_start = self.container.starts_at + timedelta(hours=1)
        hold_end = hold_start + timedelta(hours=1)
        res = self.api.post(
            "/api/booking/slots/manual-hold/",
            {
                "starts_at": hold_start.isoformat(),
                "ends_at": hold_end.isoformat(),
                "guest_name": "Иван Ручной",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data.get("is_booked"))
        self.assertEqual(res.data.get("hold_label"), "Иван Ручной")
        hold_id = res.data.get("id")
        self.assertTrue(AvailabilitySlot.objects.filter(pk=hold_id, is_booked=True).exists())

        released = self.api.post(f"/api/booking/slots/{hold_id}/release-hold/", {}, format="json")
        self.assertIn(released.status_code, (200, 204), getattr(released, "data", None))
        # Hold slot is deleted or unmarked; container remains free.
        remaining = AvailabilitySlot.objects.filter(provider=self.provider, is_booked=True).count()
        self.assertEqual(remaining, 0)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-no-hold",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.post(
            "/api/booking/slots/manual-hold/",
            {
                "starts_at": self.container.starts_at.isoformat(),
                "ends_at": (self.container.starts_at + timedelta(hours=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)
