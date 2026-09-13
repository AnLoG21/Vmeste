"""HTTP: public visit-confirm GET/POST."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import AvailabilitySlot, Booking
from catalog.models import Service
from users.models import User


class VisitConfirmApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-visit-confirm",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Confirm",
        )
        self.client_user = User.objects.create_user(
            username="client-visit-confirm",
            password="x",
            role=User.Role.CLIENT,
            first_name="Анна",
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Стрижка",
            duration_minutes=30,
            price=Decimal("1000.00"),
            is_active=True,
        )
        start = timezone.now() + timedelta(days=1)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        self.booking = Booking.objects.create(
            client=self.client_user,
            provider=self.provider,
            service=self.service,
            slot=slot,
            status=Booking.Status.NEW,
            client_confirm_token="e2e-visit-token",
        )

    def test_get_and_confirm(self):
        got = self.api.get("/api/booking/public/visit-confirm/e2e-visit-token/")
        self.assertEqual(got.status_code, 200, got.data)
        self.assertEqual(got.data.get("org"), "Салон Confirm")
        self.assertEqual(got.data.get("service"), "Стрижка")
        self.assertFalse(got.data.get("already_confirmed"))

        with patch("notifications.delivery.deliver_booking_event"):
            confirmed = self.api.post(
                "/api/booking/public/visit-confirm/e2e-visit-token/",
                {},
                format="json",
            )
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertTrue(confirmed.data.get("ok"))
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)
        self.assertIsNotNone(self.booking.client_confirmed_at)

        again = self.api.get("/api/booking/public/visit-confirm/e2e-visit-token/")
        self.assertTrue(again.data.get("already_confirmed"))

    def test_invalid_token(self):
        res = self.api.get("/api/booking/public/visit-confirm/bad-token/")
        self.assertEqual(res.status_code, 404)
