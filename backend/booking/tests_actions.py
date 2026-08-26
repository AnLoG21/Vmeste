"""Booking actions that previously regressed without CI."""

from django.test import TestCase

from catalog.models import Service
from users.models import User

from booking.booking_actions import mark_booking_no_show
from booking.models import AvailabilitySlot, Booking
from django.utils import timezone
from datetime import timedelta


class BookingNoShowTests(TestCase):
    def setUp(self):
        self.provider = User.objects.create_user(
            username="salon-noshow",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон",
        )
        self.client_user = User.objects.create_user(
            username="client-noshow",
            password="x",
            role=User.Role.CLIENT,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Стрижка",
            duration_minutes=30,
            price=1000,
            is_active=True,
        )
        start = timezone.now() + timedelta(hours=2)
        self.slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        self.booking = Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=self.slot,
            status=Booking.Status.CONFIRMED,
        )

    def test_mark_no_show_frees_slot(self):
        ok, err = mark_booking_no_show(self.booking, self.provider)
        self.assertTrue(ok, err)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.NO_SHOW)
        self.slot.refresh_from_db()
        self.assertFalse(self.slot.is_booked)
