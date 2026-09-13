"""HTTP: provider creates availability slots."""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import AvailabilitySlot
from catalog.models import Service, ServiceCategory
from users.models import User


class BookingSlotsCreateApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-slots-create",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Slots",
            anonymous_seat_count=1,
        )
        self.category = ServiceCategory.objects.create(
            provider=self.provider,
            name="Стрижки",
        )
        self.service = Service.objects.create(
            provider=self.provider,
            category=self.category,
            name="Стрижка",
            price=Decimal("1000"),
            duration_minutes=30,
            is_active=True,
        )
        self.api.force_authenticate(self.provider)

    def test_create_anonymous_slot_with_services(self):
        start = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
        end = start + timedelta(hours=2)
        res = self.api.post(
            "/api/booking/slots/",
            {
                "starts_at": start.isoformat(),
                "ends_at": end.isoformat(),
                "anonymous_index": 1,
                "service_ids": [self.service.id],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("anonymous_index"), 1)
        self.assertEqual(res.data.get("service_ids"), [self.service.id])
        slot = AvailabilitySlot.objects.get(provider=self.provider)
        self.assertFalse(slot.is_booked)
        self.assertEqual(slot.anonymous_index, 1)
        self.assertEqual(list(slot.service_ids or []), [self.service.id])

    def test_client_cannot_create(self):
        client = User.objects.create_user(
            username="client-no-slot",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        start = timezone.now() + timedelta(days=1)
        res = self.api.post(
            "/api/booking/slots/",
            {
                "starts_at": start.isoformat(),
                "ends_at": (start + timedelta(hours=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)
