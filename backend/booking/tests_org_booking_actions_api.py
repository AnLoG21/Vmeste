"""API: org confirm / mark-no-show HTTP paths."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Service
from users.models import User

from booking.models import AvailabilitySlot, Booking, ProviderAcquiring


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class OrgBookingActionsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-org-actions",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Org Actions",
            booking_confirm_message_default="Запись подтверждена на {date}.",
            booking_cancel_message_default="Запись отменена ({date}).",
            booking_done_message_default="Услуга оказана ({date}).",
        )
        self.client_user = User.objects.create_user(
            username="client-org-actions",
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
        self.api.force_authenticate(self.provider)

    def _booking(self, hours=4, **extra):
        start = timezone.now() + timedelta(hours=hours)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        defaults = dict(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=Booking.Status.NEW,
            payment_status="none",
        )
        defaults.update(extra)
        return Booking.objects.create(**defaults), slot

    def test_confirm_requires_message_template(self):
        self.provider.booking_confirm_message_default = ""
        self.provider.save(update_fields=["booking_confirm_message_default"])
        booking, _ = self._booking()
        res = self.api.post(f"/api/booking/{booking.id}/confirm/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data.get("code"), "confirm_message_not_set")

    def test_confirm_ok(self):
        booking, _ = self._booking()
        with patch("booking.booking_actions.post_booking_message"):
            with patch("notifications.delivery.deliver_booking_event"):
                res = self.api.post(f"/api/booking/{booking.id}/confirm/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)

    def test_confirm_rejects_pending_prepay(self):
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={"prepay_mode": ProviderAcquiring.PrepayMode.FULL},
        )
        booking, _ = self._booking(payment_status="pending")
        res = self.api.post(f"/api/booking/{booking.id}/confirm/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data.get("code"), "prepay_required")

    def test_mark_no_show_frees_slot_and_notifies_waitlist(self):
        booking, slot = self._booking(status=Booking.Status.CONFIRMED)
        with patch("booking.waitlist.notify_waitlist_after_slot_freed") as notify:
            with patch("notifications.delivery.deliver_booking_event"):
                res = self.api.post(f"/api/booking/{booking.id}/mark-no-show/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        slot.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.NO_SHOW)
        self.assertFalse(slot.is_booked)
        notify.assert_called_once_with(self.provider.id, self.service.id)

    def test_mark_arrived_ok(self):
        booking, _ = self._booking(status=Booking.Status.CONFIRMED)
        with patch("notifications.delivery.deliver_booking_event"):
            res = self.api.post(f"/api/booking/{booking.id}/mark-arrived/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.ARRIVED)

    def test_mark_done_rejects_before_start(self):
        booking, _ = self._booking(hours=3, status=Booking.Status.ARRIVED)
        res = self.api.post(f"/api/booking/{booking.id}/mark-done/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data.get("code"), "booking_not_started_yet")

    def test_mark_done_requires_message_template(self):
        self.provider.booking_done_message_default = ""
        self.provider.save(update_fields=["booking_done_message_default"])
        booking, _ = self._booking(hours=-1, status=Booking.Status.ARRIVED)
        res = self.api.post(f"/api/booking/{booking.id}/mark-done/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data.get("code"), "done_message_not_set")

    def test_mark_done_ok(self):
        booking, _ = self._booking(hours=-1, status=Booking.Status.ARRIVED)
        with patch("booking.booking_actions.post_booking_message"):
            with patch("notifications.delivery.deliver_booking_event"):
                with patch("booking.loyalty.consume_package_visit"):
                    with patch("booking.loyalty.award_loyalty_for_visit", return_value=0):
                        res = self.api.post(f"/api/booking/{booking.id}/mark-done/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.DONE)

    def test_cancel_by_org_requires_message_template(self):
        self.provider.booking_cancel_message_default = ""
        self.provider.save(update_fields=["booking_cancel_message_default"])
        booking, _ = self._booking(status=Booking.Status.CONFIRMED)
        res = self.api.post(f"/api/booking/{booking.id}/cancel-by-org/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data.get("code"), "cancel_message_not_set")

    def test_cancel_by_org_frees_slot_and_notifies_waitlist(self):
        booking, slot = self._booking(status=Booking.Status.CONFIRMED)
        with patch("booking.booking_actions.post_booking_message"):
            with patch("booking.waitlist.notify_waitlist_after_slot_freed") as notify:
                with patch("notifications.delivery.deliver_booking_event"):
                    res = self.api.post(f"/api/booking/{booking.id}/cancel-by-org/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        slot.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        self.assertFalse(slot.is_booked)
        notify.assert_called_once_with(self.provider.id, self.service.id)
