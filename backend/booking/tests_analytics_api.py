"""HTTP: booking analytics summary for provider/staff."""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import AvailabilitySlot, Booking
from catalog.models import Service
from users.models import User


class BookingAnalyticsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-analytics",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Analytics",
        )
        self.client_user = User.objects.create_user(
            username="client-analytics",
            password="x",
            role=User.Role.CLIENT,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Стрижка",
            duration_minutes=30,
            price=Decimal("1500.00"),
            is_active=True,
        )
        start = timezone.now() - timedelta(hours=1)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=Booking.Status.DONE,
            payment_status="paid",
        )
        self.api.force_authenticate(self.provider)

    def test_provider_summary(self):
        today = timezone.localdate()
        res = self.api.get(
            f"/api/booking/analytics/?from={(today - timedelta(days=7)).isoformat()}&to={today.isoformat()}"
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("totals", res.data)
        self.assertGreaterEqual(res.data["totals"].get("bookings") or 0, 1)
        self.assertIn("bookings", res.data)
        self.assertIn("by_day", res.data)
        self.assertIn("by_service", res.data)
        self.assertEqual(res.data["totals"].get("revenue_estimate"), 1500.0)

    def test_client_forbidden(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/booking/analytics/")
        self.assertEqual(res.status_code, 403)
