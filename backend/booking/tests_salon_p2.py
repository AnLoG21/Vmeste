"""Salon P2: loyalty award/packages, waitlist booked, no-show ↔ waitlist."""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.models import Service
from users.models import User

from booking.booking_actions import mark_booking_no_show
from booking.loyalty import (
    award_loyalty_for_visit,
    consume_package_visit,
    restore_package_visit,
    sell_package,
)
from booking.models import (
    AvailabilitySlot,
    Booking,
    LoyaltyAccount,
    LoyaltySettings,
    VisitPackage,
    WaitlistEntry,
)
from booking.waitlist import mark_waitlist_booked_for_booking, notify_waitlist_after_slot_freed
from booking.waitlist_views import WaitlistViewSet


class SalonLoyaltyFlowTests(TestCase):
    def setUp(self):
        self.provider = User.objects.create_user(
            username="salon-loy",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон",
        )
        self.client_user = User.objects.create_user(
            username="client-loy",
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
        LoyaltySettings.objects.create(
            provider=self.provider,
            enabled=True,
            points_per_visit=5,
            points_per_100_rub=1,
        )
        start = timezone.now() - timedelta(hours=1)
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
            status=Booking.Status.DONE,
        )

    def test_award_loyalty_idempotent(self):
        n1 = award_loyalty_for_visit(self.booking)
        # 5 per visit + 10 * 1 from 1000₽
        self.assertEqual(n1, 15)
        n2 = award_loyalty_for_visit(self.booking)
        self.assertEqual(n2, 0)
        acc = LoyaltyAccount.objects.get(provider=self.provider, client=self.client_user)
        self.assertEqual(acc.balance, 15)

    def test_package_sell_consume_restore(self):
        pkg = VisitPackage.objects.create(
            provider=self.provider,
            name="3 визита",
            visits_count=3,
            price=Decimal("2500"),
        )
        purchase = sell_package(provider=self.provider, client=self.client_user, package=pkg)
        self.assertEqual(purchase.visits_remaining, 3)

        booking = Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            status=Booking.Status.CONFIRMED,
        )
        used = consume_package_visit(booking, package_id=purchase.id)
        self.assertIsNotNone(used)
        purchase.refresh_from_db()
        self.assertEqual(purchase.visits_remaining, 2)
        booking.refresh_from_db()
        self.assertEqual(booking.client_package_id, purchase.id)

        self.assertTrue(restore_package_visit(booking))
        purchase.refresh_from_db()
        self.assertEqual(purchase.visits_remaining, 3)


class SalonNoShowWaitlistTests(TestCase):
    def setUp(self):
        self.provider = User.objects.create_user(
            username="salon-ns",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон",
        )
        self.client_a = User.objects.create_user(username="c-a", password="x", role=User.Role.CLIENT)
        self.client_b = User.objects.create_user(username="c-b", password="x", role=User.Role.CLIENT)
        self.service = Service.objects.create(
            provider=self.provider,
            name="Окрашивание",
            duration_minutes=60,
            price=Decimal("2000"),
            is_active=True,
        )
        start = timezone.now() + timedelta(hours=3)
        self.slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=60),
            is_booked=True,
        )
        self.booking = Booking.objects.create(
            provider=self.provider,
            client=self.client_a,
            service=self.service,
            slot=self.slot,
            status=Booking.Status.CONFIRMED,
        )

    def test_no_show_does_not_restore_package(self):
        pkg = VisitPackage.objects.create(
            provider=self.provider,
            name="Абонемент",
            visits_count=2,
            price=Decimal("1000"),
        )
        purchase = sell_package(provider=self.provider, client=self.client_a, package=pkg)
        consume_package_visit(self.booking, package_id=purchase.id)
        purchase.refresh_from_db()
        remaining_before = purchase.visits_remaining

        ok, err = mark_booking_no_show(self.booking, self.provider)
        self.assertTrue(ok, err)
        purchase.refresh_from_db()
        self.assertEqual(purchase.visits_remaining, remaining_before)

    def test_no_show_notifies_waitlist(self):
        entry = WaitlistEntry.objects.create(
            provider=self.provider,
            client=self.client_b,
            service=self.service,
            status=WaitlistEntry.Status.WAITING,
        )
        with patch("notifications.push.notify_users"):
            with patch("notifications.delivery._fanout_user_channels"):
                with patch("notifications.delivery.get_or_create_messaging"):
                    with patch("notifications.delivery.deliver_booking_event"):
                        ok, err = mark_booking_no_show(self.booking, self.provider)
        self.assertTrue(ok, err)
        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistEntry.Status.NOTIFIED)

    def test_mark_waitlist_booked(self):
        waiting = WaitlistEntry.objects.create(
            provider=self.provider,
            client=self.client_a,
            service=self.service,
            status=WaitlistEntry.Status.WAITING,
        )
        notified = WaitlistEntry.objects.create(
            provider=self.provider,
            client=self.client_a,
            service=self.service,
            status=WaitlistEntry.Status.NOTIFIED,
        )
        other = WaitlistEntry.objects.create(
            provider=self.provider,
            client=self.client_b,
            service=self.service,
            status=WaitlistEntry.Status.WAITING,
        )
        n = mark_waitlist_booked_for_booking(self.booking)
        self.assertEqual(n, 2)
        waiting.refresh_from_db()
        notified.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(waiting.status, WaitlistEntry.Status.BOOKED)
        self.assertEqual(notified.status, WaitlistEntry.Status.BOOKED)
        self.assertEqual(other.status, WaitlistEntry.Status.WAITING)

    def test_notify_marks_first_waiting(self):
        e1 = WaitlistEntry.objects.create(
            provider=self.provider,
            client=self.client_b,
            service=self.service,
            status=WaitlistEntry.Status.WAITING,
        )
        with patch("notifications.push.notify_users"):
            with patch("notifications.delivery._fanout_user_channels"):
                with patch("notifications.delivery.get_or_create_messaging"):
                    count = notify_waitlist_after_slot_freed(self.provider.id, self.service.id)
        self.assertEqual(count, 1)
        e1.refresh_from_db()
        self.assertEqual(e1.status, WaitlistEntry.Status.NOTIFIED)


class WaitlistApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.provider = User.objects.create_user(
            username="salon-wl-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
        )
        self.client_user = User.objects.create_user(
            username="client-wl-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Маникюр",
            duration_minutes=45,
            price=Decimal("800"),
            is_active=True,
        )

    def test_join_dedupe_and_invalid_date(self):
        req = self.factory.post(
            "/api/booking/waitlist/",
            {
                "provider_id": self.provider.id,
                "service_id": self.service.id,
                "preferred_date": "not-a-date",
            },
            format="json",
        )
        force_authenticate(req, user=self.client_user)
        resp = WaitlistViewSet.as_view({"post": "create"})(req)
        self.assertEqual(resp.status_code, 400)

        req2 = self.factory.post(
            "/api/booking/waitlist/",
            {
                "provider_id": self.provider.id,
                "service_id": self.service.id,
                "preferred_date": date.today().isoformat(),
            },
            format="json",
        )
        force_authenticate(req2, user=self.client_user)
        resp2 = WaitlistViewSet.as_view({"post": "create"})(req2)
        self.assertEqual(resp2.status_code, 201)
        first_id = resp2.data["id"]

        req3 = self.factory.post(
            "/api/booking/waitlist/",
            {"provider_id": self.provider.id, "service_id": self.service.id},
            format="json",
        )
        force_authenticate(req3, user=self.client_user)
        resp3 = WaitlistViewSet.as_view({"post": "create"})(req3)
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(resp3.data["id"], first_id)

    def test_cancel(self):
        entry = WaitlistEntry.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
        )
        req = self.factory.patch(
            f"/api/booking/waitlist/{entry.id}/",
            {"status": "cancelled"},
            format="json",
        )
        force_authenticate(req, user=self.client_user)
        resp = WaitlistViewSet.as_view({"patch": "partial_update"})(req, pk=entry.id)
        self.assertEqual(resp.status_code, 200)
        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistEntry.Status.CANCELLED)
