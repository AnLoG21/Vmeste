"""HTTP: provider deletes availability slots."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import AvailabilitySlot
from users.models import User


class BookingSlotsDeleteApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-slots-delete",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Slots Del",
            anonymous_seat_count=1,
        )
        start = timezone.now().replace(hour=11, minute=0, second=0, microsecond=0) + timedelta(days=1)
        self.slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(hours=1),
            is_booked=False,
            anonymous_index=1,
        )
        self.api.force_authenticate(self.provider)

    def test_provider_deletes_slot(self):
        res = self.api.delete(f"/api/booking/slots/{self.slot.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(AvailabilitySlot.objects.filter(id=self.slot.id).exists())

    def test_client_cannot_delete(self):
        client = User.objects.create_user(
            username="client-no-slot-del",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.delete(f"/api/booking/slots/{self.slot.id}/")
        self.assertIn(res.status_code, (403, 404))
        self.assertTrue(AvailabilitySlot.objects.filter(id=self.slot.id).exists())
