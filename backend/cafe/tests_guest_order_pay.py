"""API scenarios: cafe guest order → online / cash / payment failure."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from cafe.models import (
    CafeGuestSession,
    CafeMenuCategory,
    CafeMenuItem,
    CafeOrder,
    CafeSettings,
)
from users.models import User


def _always_open_hours():
    return {d: {"open": "00:00", "close": "23:59", "closed": False} for d in (
        "mon", "tue", "wed", "thu", "fri", "sat", "sun"
    )}


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class CafeGuestOrderPayTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="cafe-pay-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.CAFE_RESTAURANT,
            organization_name="Кафе API",
            organization_slug="cafe-pay-api",
            organization_working_hours=_always_open_hours(),
        )
        self.settings = CafeSettings.objects.create(
            provider=self.provider,
            enable_takeaway=True,
            enable_delivery=False,
            enable_dine_in=False,
            accept_online_payment=True,
            accept_cash=True,
            accept_card_on_spot=True,
            yookassa_shop_id="shop-cafe",
            yookassa_secret_key="secret-cafe",
        )
        cat = CafeMenuCategory.objects.create(provider=self.provider, name="Основное")
        self.item = CafeMenuItem.objects.create(
            category=cat,
            name="Борщ",
            price=Decimal("500.00"),
            is_active=True,
            is_available=True,
        )
        self.session = CafeGuestSession.create_session(provider=self.provider, table=None)

    def _headers(self):
        return {"HTTP_X_CAFE_SESSION": self.session.token}

    def _payload(self, **extra):
        body = {
            "mode": CafeOrder.Mode.TAKEAWAY,
            "pay_method": CafeOrder.PayMethod.ONLINE,
            "guest_phone": "+79001234567",
            "guest_name": "Гость",
            "items": [{"menu_item": self.item.id, "quantity": 1}],
            "include_service_charge": True,
            "tip_percent": 0,
            "tip_custom": False,
            "tip_amount": 0,
        }
        body.update(extra)
        return body

    def test_online_takeaway_returns_confirmation_url(self):
        with patch(
            "payments.gateway.create_org_payment",
            return_value={"id": "yk-cafe-1", "confirmation_url": "https://pay.example/cafe"},
        ) as create_pay:
            with patch("payments.gateway.provider_ready", return_value=True):
                with patch("cafe.notify.notify_new_cafe_order"):
                    with patch("cafe.views.send_order_receipt_after_payment"):
                        res = self.api.post(
                            "/api/cafe/guest/order/",
                            self._payload(),
                            format="json",
                            **self._headers(),
                        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("confirmation_url"), "https://pay.example/cafe")
        self.assertEqual(res.data.get("status"), CafeOrder.Status.AWAITING_PAYMENT)
        create_pay.assert_called_once()
        kwargs = create_pay.call_args.kwargs
        self.assertEqual(kwargs["metadata"]["type"], "cafe_order")
        self.assertTrue(str(kwargs["order_id"]).startswith("c"))
        # 500 + 3% service = 515
        self.assertEqual(Decimal(str(kwargs["amount"])), Decimal("515.00"))
        order = CafeOrder.objects.get(pk=res.data["id"])
        self.assertEqual(order.yookassa_payment_id, "yk-cafe-1")
        self.assertEqual(order.total, Decimal("515.00"))

    def test_cash_does_not_call_yookassa(self):
        with patch("payments.gateway.create_org_payment") as create_pay:
            with patch("cafe.notify.notify_new_cafe_order"):
                with patch("cafe.views.send_order_receipt_after_payment") as receipt:
                    res = self.api.post(
                        "/api/cafe/guest/order/",
                        self._payload(pay_method=CafeOrder.PayMethod.CASH),
                        format="json",
                        **self._headers(),
                    )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("status"), CafeOrder.Status.ACCEPTED)
        self.assertFalse(res.data.get("confirmation_url"))
        create_pay.assert_not_called()
        receipt.assert_called_once()

    def test_online_create_payment_failure_deletes_order(self):
        with patch("payments.gateway.create_org_payment", return_value=None):
            with patch("payments.gateway.provider_ready", return_value=True):
                with patch("cafe.notify.notify_new_cafe_order"):
                    res = self.api.post(
                        "/api/cafe/guest/order/",
                        self._payload(),
                        format="json",
                        **self._headers(),
                    )
        self.assertEqual(res.status_code, 502, res.data)
        self.assertEqual(CafeOrder.objects.count(), 0)

    def test_tip_percent_included_in_payment_amount(self):
        with patch(
            "payments.gateway.create_org_payment",
            return_value={"id": "yk-cafe-tip", "confirmation_url": "https://pay.example/tip"},
        ) as create_pay:
            with patch("payments.gateway.provider_ready", return_value=True):
                with patch("cafe.notify.notify_new_cafe_order"):
                    res = self.api.post(
                        "/api/cafe/guest/order/",
                        self._payload(tip_percent=10),
                        format="json",
                        **self._headers(),
                    )
        self.assertEqual(res.status_code, 201, res.data)
        # 500 + tip 50 + service 15 = 565
        self.assertEqual(Decimal(str(create_pay.call_args.kwargs["amount"])), Decimal("565.00"))
