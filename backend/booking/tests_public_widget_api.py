"""HTTP: public booking widget catalog / book (AllowAny)."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import AvailabilitySlot, Booking
from catalog.models import Service
from users.models import User


class PublicWidgetApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-widget-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Widget",
            organization_slug="e2e-widget-salon",
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
        self.slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(hours=4),
            is_booked=False,
            anonymous_index=1,
            service_ids=[self.service.id],
        )

    def test_catalog_by_slug(self):
        res = self.api.get("/api/booking/public/e2e-widget-salon/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("organization_name"), "Салон Widget")
        self.assertEqual(res.data.get("slug"), "e2e-widget-salon")
        self.assertEqual(len(res.data.get("services") or []), 1)
        self.assertEqual(res.data["services"][0]["name"], "Стрижка")

    def test_catalog_404(self):
        res = self.api.get("/api/booking/public/no-such-org/")
        self.assertEqual(res.status_code, 404)

    def test_dates_and_windows(self):
        day = self.slot.starts_at.date().isoformat()
        dates = self.api.get(
            f"/api/booking/public/e2e-widget-salon/dates/?service={self.service.id}"
            f"&from={day}&to={day}"
        )
        self.assertEqual(dates.status_code, 200, dates.data)
        self.assertIn(day, dates.data.get("dates") or [])

        windows = self.api.get(
            f"/api/booking/public/e2e-widget-salon/windows/?service={self.service.id}&date={day}"
        )
        self.assertEqual(windows.status_code, 200, windows.data)
        self.assertGreater(len(windows.data), 0)
        self.assertIn("starts_at", windows.data[0])

    def test_book_creates_booking(self):
        day = self.slot.starts_at.date().isoformat()
        windows = self.api.get(
            f"/api/booking/public/e2e-widget-salon/windows/?service={self.service.id}&date={day}"
        )
        win = windows.data[0]
        with patch("booking.booking_actions.notify_new_booking"):
            res = self.api.post(
                "/api/booking/public/e2e-widget-salon/book/",
                {
                    "service": self.service.id,
                    "starts_at": win["starts_at"],
                    "ends_at": win["ends_at"],
                    "guest_name": "Гость Виджет",
                    "guest_phone": "+79001112233",
                },
                format="json",
            )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("service"), "Стрижка")
        self.assertIn("Запись создана", res.data.get("message") or "")
        self.assertTrue(Booking.objects.filter(provider=self.provider, service=self.service).exists())

    def test_book_requires_phone(self):
        res = self.api.post(
            "/api/booking/public/e2e-widget-salon/book/",
            {
                "service": self.service.id,
                "starts_at": self.slot.starts_at.isoformat(),
                "ends_at": (self.slot.starts_at + timedelta(minutes=30)).isoformat(),
                "guest_phone": "123",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
