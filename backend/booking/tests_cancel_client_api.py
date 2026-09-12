"""API: client cancel booking restores package visit and notifies waitlist."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Service
from users.models import User

from booking.models import AvailabilitySlot, Booking, ClientPackage, VisitPackage


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class CancelClientApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-cancel-client",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Cancel",
        )
        self.client_user = User.objects.create_user(
            username="client-cancel-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.other = User.objects.create_user(
            username="client-cancel-other",
            password="x",
            role=User.Role.CLIENT,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Стрижка",
            duration_minutes=30,
            price=Decimal("1000.00"),
            is_active=True,
        )
        self.api.force_authenticate(self.client_user)

    def _booked_slot(self):
        start = timezone.now() + timedelta(hours=5)
        return AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )

    def test_cancel_restores_package_and_frees_slot(self):
        pkg = VisitPackage.objects.create(
            provider=self.provider,
            name="5 стрижек",
            visits_count=5,
            price=Decimal("4000.00"),
            is_active=True,
        )
        purchase = ClientPackage.objects.create(
            provider=self.provider,
            client=self.client_user,
            package=pkg,
            visits_total=5,
            visits_remaining=2,
            status=ClientPackage.Status.ACTIVE,
        )
        slot = self._booked_slot()
        booking = Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=Booking.Status.NEW,
            client_package=purchase,
            payment_status="paid",
        )
        with patch("booking.waitlist.notify_waitlist_after_slot_freed") as notify:
            with patch("booking.booking_actions.post_booking_message"):
                with patch("notifications.delivery.deliver_booking_event"):
                    res = self.api.post(f"/api/booking/{booking.id}/cancel-by-client/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        purchase.refresh_from_db()
        slot.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        self.assertIsNone(booking.client_package_id)
        self.assertEqual(purchase.visits_remaining, 3)
        self.assertFalse(slot.is_booked)
        notify.assert_called_once_with(self.provider.id, self.service.id)

    def test_cancel_wrong_client_forbidden(self):
        slot = self._booked_slot()
        booking = Booking.objects.create(
            provider=self.provider,
            client=self.other,
            service=self.service,
            slot=slot,
            status=Booking.Status.NEW,
        )
        with patch("booking.waitlist.notify_waitlist_after_slot_freed"):
            res = self.api.post(f"/api/booking/{booking.id}/cancel-by-client/", {}, format="json")
        self.assertEqual(res.status_code, 403)
