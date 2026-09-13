"""HTTP: provider book-for-client."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import AvailabilitySlot, Booking
from catalog.models import Service
from users.models import User


class BookForClientApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-book-for-client",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон BookClient",
            anonymous_seat_count=1,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Стрижка",
            duration_minutes=30,
            price=Decimal("1000.00"),
            is_active=True,
        )
        start = timezone.now().replace(minute=0, second=0, microsecond=0) + timedelta(days=1)
        start = start.replace(hour=10)
        self.container = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(hours=4),
            is_booked=False,
            anonymous_index=1,
            service_ids=[self.service.id],
        )
        self.api.force_authenticate(self.provider)

    def test_book_by_guest_name(self):
        starts = self.container.starts_at + timedelta(hours=1)
        ends = starts + timedelta(minutes=30)
        with patch("booking.booking_actions.notify_new_booking"):
            res = self.api.post(
                "/api/booking/book-for-client/",
                {
                    "service": self.service.id,
                    "starts_at": starts.isoformat(),
                    "ends_at": ends.isoformat(),
                    "name": "Мария Новая",
                },
                format="json",
            )
        self.assertEqual(res.status_code, 201, res.data)
        booking = Booking.objects.get(provider=self.provider)
        self.assertEqual(booking.service_id, self.service.id)
        self.assertEqual(booking.client.first_name, "Мария")

    def test_requires_name_or_client(self):
        res = self.api.post(
            "/api/booking/book-for-client/",
            {
                "service": self.service.id,
                "starts_at": self.container.starts_at.isoformat(),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-no-book-for",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.post(
            "/api/booking/book-for-client/",
            {
                "service": self.service.id,
                "starts_at": self.container.starts_at.isoformat(),
                "name": "X",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)
