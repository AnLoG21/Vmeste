"""Loyalty redeem must reduce payable / prepay amount."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from catalog.models import Service
from users.models import User

from booking.acquiring import attach_prepay_if_needed, booking_payable_total
from booking.loyalty import (
    get_or_create_loyalty_account,
    get_or_create_loyalty_settings,
    plan_loyalty_redeem,
    redeem_loyalty_points,
)
from booking.models import AvailabilitySlot, Booking, ProviderAcquiring


class LoyaltyRedeemPayTests(TestCase):
    def setUp(self):
        self.provider = User.objects.create_user(
            username="salon-loyalty-pay",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон",
        )
        self.client_user = User.objects.create_user(
            username="client-loyalty-pay",
            password="x",
            role=User.Role.CLIENT,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Стрижка",
            duration_minutes=30,
            price=Decimal("100.00"),
            is_active=True,
        )
        settings = get_or_create_loyalty_settings(self.provider)
        settings.enabled = True
        settings.rub_per_point = Decimal("1.00")
        settings.save()
        account = get_or_create_loyalty_account(self.provider, self.client_user)
        account.balance = 100
        account.save(update_fields=["balance", "updated_at"])
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
            status=Booking.Status.NEW,
        )
        ProviderAcquiring.objects.update_or_create(
            provider=self.provider,
            defaults={
                "prepay_mode": ProviderAcquiring.PrepayMode.FULL,
                "yookassa_shop_id": "shop",
                "yookassa_secret_key": "secret",
            },
        )

    def test_plan_caps_to_service_price(self):
        pts, disc = plan_loyalty_redeem(
            provider=self.provider,
            client=self.client_user,
            points=500,
            booking=self.booking,
        )
        self.assertEqual(pts, 100)
        self.assertEqual(disc, Decimal("100.00"))

    def test_full_points_cover_prepay(self):
        pts, disc = plan_loyalty_redeem(
            provider=self.provider,
            client=self.client_user,
            points=100,
            booking=self.booking,
        )
        redeem_loyalty_points(
            provider=self.provider,
            client=self.client_user,
            points=pts,
            booking=self.booking,
        )
        self.booking.loyalty_points_redeemed = pts
        self.booking.loyalty_discount = disc
        self.booking.save(update_fields=["loyalty_points_redeemed", "loyalty_discount"])
        self.assertEqual(booking_payable_total(self.booking), Decimal("0.00"))
        with patch("booking.acquiring.create_org_payment") as create_pay:
            extra = attach_prepay_if_needed(self.booking)
        create_pay.assert_not_called()
        self.assertIsNone(extra)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.payment_status, "paid")
        self.assertEqual(self.booking.prepay_amount, Decimal("0.00"))

    def test_partial_points_reduce_prepay_amount(self):
        pts, disc = plan_loyalty_redeem(
            provider=self.provider,
            client=self.client_user,
            points=40,
            booking=self.booking,
        )
        self.assertEqual(disc, Decimal("40.00"))
        self.booking.loyalty_points_redeemed = pts
        self.booking.loyalty_discount = disc
        self.booking.save(update_fields=["loyalty_points_redeemed", "loyalty_discount"])
        self.assertEqual(booking_payable_total(self.booking), Decimal("60.00"))
        with patch(
            "booking.acquiring.create_org_payment",
            return_value={"id": "pay1", "confirmation_url": "https://pay.example/1"},
        ) as create_pay:
            with patch("booking.acquiring.provider_ready", return_value=True):
                extra = attach_prepay_if_needed(self.booking)
        self.assertIsNotNone(extra)
        create_pay.assert_called_once()
        self.assertEqual(create_pay.call_args.kwargs["amount"], Decimal("60.00"))
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.prepay_amount, Decimal("60.00"))
