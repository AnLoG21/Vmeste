"""YooKassa webhook routes booking / cafe / shop / subscription payments."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Service
from users.models import User

from booking.models import AvailabilitySlot, Booking
from cafe.models import CafeOrder
from shop.models import ShopOrder
from subscriptions.models import Payment, SubscriptionPlan, UserSubscription


class YooKassaWebhookRoutingTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="wh-provider",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="WH Org",
        )
        self.client_user = User.objects.create_user(
            username="wh-client",
            password="x",
            role=User.Role.CLIENT,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Услуга",
            duration_minutes=30,
            price=Decimal("500.00"),
            is_active=True,
        )

    def _post(self, payment_id, metadata=None, event="payment.succeeded"):
        return self.api.post(
            "/api/subscriptions/webhook/yookassa/",
            {
                "event": event,
                "object": {
                    "id": payment_id,
                    "status": "succeeded",
                    "metadata": metadata or {},
                },
            },
            format="json",
        )

    def _booking(self, yk_id="yk-book-1", status="pending"):
        start = timezone.now() + timedelta(hours=2)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        return Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=Booking.Status.NEW,
            payment_status=status,
            yookassa_payment_id=yk_id,
            prepay_amount=Decimal("500.00"),
        )

    def test_ignored_non_succeeded_event(self):
        res = self._post("yk-x", event="payment.waiting_for_capture")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("detail"), "ignored")

    def test_booking_by_metadata(self):
        booking = self._booking("yk-meta-book")
        with patch("booking.booking_actions.notify_new_booking"):
            res = self._post(
                "yk-meta-book",
                {"type": "booking", "booking_id": str(booking.id)},
            )
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.payment_status, "paid")
        self.assertIsNotNone(booking.paid_at)

    def test_booking_fallback_by_payment_id(self):
        booking = self._booking("yk-fallback-book")
        with patch("booking.booking_actions.notify_new_booking"):
            res = self._post("yk-fallback-book", {})
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.payment_status, "paid")

    def test_cafe_order_by_metadata(self):
        order = CafeOrder.objects.create(
            provider=self.provider,
            client=self.client_user,
            status=CafeOrder.Status.AWAITING_PAYMENT,
            total=Decimal("350.00"),
            yookassa_payment_id="yk-cafe-1",
        )
        with patch("cafe.receipt_service.send_order_receipt_after_payment"):
            res = self._post("yk-cafe-1", {"type": "cafe_order", "order_id": str(order.id)})
        self.assertEqual(res.status_code, 200, res.data)
        order.refresh_from_db()
        self.assertEqual(order.status, CafeOrder.Status.PAID)
        self.assertIsNotNone(order.paid_at)

    def test_shop_order_by_metadata(self):
        order = ShopOrder.objects.create(
            provider=self.provider,
            client=self.client_user,
            status=ShopOrder.Status.AWAITING_PAYMENT,
            total=Decimal("990.00"),
            yookassa_payment_id="yk-shop-1",
        )
        with patch("shop.payments.writeoff_shop_order"):
            with patch("shop.notify.notify_shop_order_status"):
                with patch("subscriptions.yookassa_client.get_payment", return_value=None):
                    with patch("vmagazine.cards.upsert_saved_card_from_yookassa_payment"):
                        res = self._post(
                            "yk-shop-1",
                            {"type": "shop_order", "order_id": str(order.id)},
                        )
        self.assertEqual(res.status_code, 200, res.data)
        order.refresh_from_db()
        self.assertEqual(order.status, ShopOrder.Status.PAID)

    def test_subscription_payment_succeeded(self):
        plan = SubscriptionPlan.objects.create(
            slug="wh-plan",
            name="План",
            price_monthly=Decimal("990.00"),
            is_active=True,
        )
        sub = UserSubscription.objects.create(
            user=self.provider,
            plan=plan,
            status=UserSubscription.Status.PENDING,
        )
        payment = Payment.objects.create(
            user=self.provider,
            subscription=sub,
            plan=plan,
            amount=Decimal("990.00"),
            status=Payment.Status.PENDING,
            yookassa_payment_id="yk-sub-1",
        )
        with patch("subscriptions.views._activate_subscription") as activate:
            res = self._post("yk-sub-1", {"type": "subscription"})
        self.assertEqual(res.status_code, 200, res.data)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.SUCCEEDED)
        activate.assert_called_once()

    def test_unknown_payment_returns_404(self):
        res = self._post("yk-missing-xyz", {"type": "subscription"})
        self.assertEqual(res.status_code, 404)
