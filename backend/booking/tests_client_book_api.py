"""API scenarios: client book → prepay / loyalty / package / pay resume / return_url."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Service
from users.models import User

from booking.loyalty import get_or_create_loyalty_account, get_or_create_loyalty_settings
from booking.models import (
    AvailabilitySlot,
    Booking,
    ClientPackage,
    ProviderAcquiring,
    VisitPackage,
    WaitlistEntry,
)


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class ClientBookApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-book-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон API",
        )
        self.client_user = User.objects.create_user(
            username="client-book-api",
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

    def _free_slot(self, hours=3):
        start = timezone.now() + timedelta(hours=hours)
        return AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=False,
        )

    def _book_payload(self, slot, **extra):
        body = {
            "provider": self.provider.id,
            "service": self.service.id,
            "slot": slot.id,
        }
        body.update(extra)
        return body

    def test_create_without_prepay_no_confirmation_url(self):
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={"prepay_mode": ProviderAcquiring.PrepayMode.OFF},
        )
        slot = self._free_slot()
        with patch("booking.booking_actions.notify_new_booking"):
            res = self.api.post("/api/booking/", self._book_payload(slot), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertFalse(res.data.get("confirmation_url"))
        booking = Booking.objects.get(pk=res.data["id"])
        self.assertEqual(booking.payment_status, "none")
        slot.refresh_from_db()
        self.assertTrue(slot.is_booked)

    def test_create_full_prepay_returns_confirmation_url(self):
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={
                "prepay_mode": ProviderAcquiring.PrepayMode.FULL,
                "yookassa_shop_id": "shop",
                "yookassa_secret_key": "secret",
            },
        )
        slot = self._free_slot(4)
        with patch(
            "booking.acquiring.create_org_payment",
            return_value={"id": "yk-full-1", "confirmation_url": "https://pay.example/full"},
        ) as create_pay:
            with patch("booking.acquiring.provider_ready", return_value=True):
                with patch("booking.booking_actions.notify_new_booking"):
                    res = self.api.post("/api/booking/", self._book_payload(slot), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("confirmation_url"), "https://pay.example/full")
        create_pay.assert_called_once()
        booking = Booking.objects.get(pk=res.data["id"])
        self.assertEqual(booking.payment_status, "pending")
        self.assertEqual(booking.yookassa_payment_id, "yk-full-1")
        slot.refresh_from_db()
        self.assertTrue(slot.is_booked)

    def test_create_percent_prepay_amount(self):
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={
                "prepay_mode": ProviderAcquiring.PrepayMode.PERCENT,
                "prepay_percent": 50,
                "yookassa_shop_id": "shop",
                "yookassa_secret_key": "secret",
            },
        )
        slot = self._free_slot(5)
        with patch(
            "booking.acquiring.create_org_payment",
            return_value={"id": "yk-pct-1", "confirmation_url": "https://pay.example/pct"},
        ) as create_pay:
            with patch("booking.acquiring.provider_ready", return_value=True):
                with patch("booking.booking_actions.notify_new_booking"):
                    res = self.api.post("/api/booking/", self._book_payload(slot), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("confirmation_url"), "https://pay.example/pct")
        self.assertEqual(create_pay.call_args.kwargs["amount"], Decimal("500.00"))

    def test_loyalty_covers_full_amount_skips_yookassa(self):
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={
                "prepay_mode": ProviderAcquiring.PrepayMode.FULL,
                "yookassa_shop_id": "shop",
                "yookassa_secret_key": "secret",
            },
        )
        settings = get_or_create_loyalty_settings(self.provider)
        settings.enabled = True
        settings.rub_per_point = Decimal("1.00")
        settings.save()
        account = get_or_create_loyalty_account(self.provider, self.client_user)
        account.balance = 1000
        account.save(update_fields=["balance", "updated_at"])
        slot = self._free_slot(6)
        with patch("booking.acquiring.create_org_payment") as create_pay:
            with patch("booking.acquiring.provider_ready", return_value=True):
                with patch("booking.booking_actions.notify_new_booking"):
                    res = self.api.post(
                        "/api/booking/",
                        self._book_payload(slot, loyalty_points=1000),
                        format="json",
                    )
        self.assertEqual(res.status_code, 201, res.data)
        create_pay.assert_not_called()
        self.assertFalse(res.data.get("confirmation_url"))
        booking = Booking.objects.get(pk=res.data["id"])
        self.assertEqual(booking.payment_status, "paid")
        self.assertEqual(booking.loyalty_points_redeemed, 1000)

    def test_package_visit_skips_prepay(self):
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={
                "prepay_mode": ProviderAcquiring.PrepayMode.FULL,
                "yookassa_shop_id": "shop",
                "yookassa_secret_key": "secret",
            },
        )
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
            visits_remaining=3,
            status=ClientPackage.Status.ACTIVE,
        )
        slot = self._free_slot(7)
        with patch("booking.acquiring.create_org_payment") as create_pay:
            with patch("booking.acquiring.provider_ready", return_value=True):
                with patch("booking.booking_actions.notify_new_booking"):
                    res = self.api.post(
                        "/api/booking/",
                        self._book_payload(slot, use_package=True, client_package=purchase.id),
                        format="json",
                    )
        self.assertEqual(res.status_code, 201, res.data)
        create_pay.assert_not_called()
        booking = Booking.objects.get(pk=res.data["id"])
        self.assertEqual(booking.payment_status, "paid")
        self.assertEqual(booking.client_package_id, purchase.id)
        purchase.refresh_from_db()
        self.assertEqual(purchase.visits_remaining, 2)

    def test_pay_resume_returns_existing_url(self):
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={
                "prepay_mode": ProviderAcquiring.PrepayMode.FULL,
                "yookassa_shop_id": "shop",
                "yookassa_secret_key": "secret",
            },
        )
        start = timezone.now() + timedelta(hours=8)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        booking = Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=Booking.Status.NEW,
            payment_status="pending",
            payment_url="https://pay.example/resume",
            yookassa_payment_id="yk-resume",
            prepay_amount=Decimal("1000.00"),
        )
        with patch("booking.acquiring.sync_booking_from_yookassa", return_value=False):
            res = self.api.post(f"/api/booking/{booking.id}/pay/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("confirmation_url"), "https://pay.example/resume")

    def test_pay_already_paid_no_url(self):
        start = timezone.now() + timedelta(hours=9)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        booking = Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=Booking.Status.NEW,
            payment_status="paid",
        )
        with patch("booking.acquiring.sync_booking_from_yookassa", return_value=False):
            res = self.api.post(f"/api/booking/{booking.id}/pay/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data.get("confirmation_url"))

    def test_prepay_return_url_points_to_activity(self):
        from booking.acquiring import attach_prepay_if_needed

        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={
                "prepay_mode": ProviderAcquiring.PrepayMode.FULL,
                "yookassa_shop_id": "shop",
                "yookassa_secret_key": "secret",
            },
        )
        start = timezone.now() + timedelta(hours=10)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        booking = Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=Booking.Status.NEW,
        )
        with patch(
            "booking.acquiring.create_org_payment",
            return_value={"id": "yk-ret", "confirmation_url": "https://pay.example/ret"},
        ) as create_pay:
            with patch("booking.acquiring.provider_ready", return_value=True):
                extra = attach_prepay_if_needed(booking)
        self.assertIsNotNone(extra)
        return_url = create_pay.call_args.kwargs.get("return_url") or ""
        self.assertIn("/activity?booking_payment=success", return_url)
        self.assertIn(f"booking_id={booking.id}", return_url)

    def test_create_booking_marks_waitlist_booked(self):
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={"prepay_mode": ProviderAcquiring.PrepayMode.OFF},
        )
        waiting = WaitlistEntry.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            status=WaitlistEntry.Status.WAITING,
        )
        notified = WaitlistEntry.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            status=WaitlistEntry.Status.NOTIFIED,
        )
        other_client = User.objects.create_user(
            username="client-waitlist-other",
            password="x",
            role=User.Role.CLIENT,
        )
        other = WaitlistEntry.objects.create(
            provider=self.provider,
            client=other_client,
            service=self.service,
            status=WaitlistEntry.Status.WAITING,
        )
        slot = self._free_slot(11)
        with patch("booking.booking_actions.notify_new_booking"):
            res = self.api.post("/api/booking/", self._book_payload(slot), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        waiting.refresh_from_db()
        notified.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(waiting.status, WaitlistEntry.Status.BOOKED)
        self.assertEqual(notified.status, WaitlistEntry.Status.BOOKED)
        self.assertEqual(other.status, WaitlistEntry.Status.WAITING)
