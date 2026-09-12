"""API scenarios: public shop order → online / cash / payment failure."""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from booking.models import ProviderAcquiring
from shop.models import Product, ShopOrder, ShopSettings
from users.models import User


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class PublicShopOrderPayTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="shop-pay-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Магазин API",
            organization_slug="shop-pay-api",
        )
        self.settings = ShopSettings.objects.create(
            provider=self.provider,
            enable_pickup=True,
            enable_delivery=False,
            accept_online_payment=True,
        )
        ProviderAcquiring.objects.create(
            provider=self.provider,
            yookassa_shop_id="shop-mp",
            yookassa_secret_key="secret-mp",
        )
        self.product = Product.objects.create(
            provider=self.provider,
            name="Футболка",
            price=Decimal("1000.00"),
            stock_qty=Decimal("10"),
            is_active=True,
        )

    def _payload(self, **extra):
        body = {
            "mode": "pickup",
            "payment_method": "online",
            "guest_name": "Покупатель",
            "guest_phone": "+79007654321",
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "return_url": "https://vsevmeste.space/s/shop-pay-api?order=1",
        }
        body.update(extra)
        return body

    def test_online_pickup_returns_confirmation_url(self):
        with patch(
            "shop.views.create_org_payment",
            return_value={"id": "yk-shop-1", "confirmation_url": "https://pay.example/shop"},
        ) as create_pay:
            with patch("shop.notify.notify_new_shop_order"):
                res = self.api.post(
                    "/api/shop/public/shop-pay-api/order/",
                    self._payload(),
                    format="json",
                )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("confirmation_url"), "https://pay.example/shop")
        self.assertEqual(res.data.get("status"), ShopOrder.Status.AWAITING_PAYMENT)
        create_pay.assert_called_once()
        kwargs = create_pay.call_args.kwargs
        self.assertEqual(kwargs["metadata"]["type"], "shop_order")
        self.assertTrue(str(kwargs["order_id"]).startswith("s"))
        self.assertEqual(Decimal(str(kwargs["amount"])), Decimal("1000.00"))
        order = ShopOrder.objects.get(pk=res.data["order_id"])
        self.assertEqual(order.yookassa_payment_id, "yk-shop-1")

    def test_cash_marks_paid_without_yookassa(self):
        with patch("shop.views.create_org_payment") as create_pay:
            with patch("shop.notify.notify_new_shop_order"):
                with patch("shop.notify.notify_shop_order_status"):
                    res = self.api.post(
                        "/api/shop/public/shop-pay-api/order/",
                        self._payload(payment_method="cash"),
                        format="json",
                    )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("status"), ShopOrder.Status.PAID)
        self.assertEqual(res.data.get("confirmation_url"), "")
        create_pay.assert_not_called()

    def test_online_payment_create_failure_cancels_order(self):
        with patch("shop.views.create_org_payment", side_effect=RuntimeError("yk down")):
            with patch("shop.notify.notify_new_shop_order"):
                with patch("vmagazine.bonuses.refund_order_bonuses") as refund:
                    res = self.api.post(
                        "/api/shop/public/shop-pay-api/order/",
                        self._payload(),
                        format="json",
                    )
        self.assertEqual(res.status_code, 400, res.data)
        order = ShopOrder.objects.get()
        self.assertEqual(order.status, ShopOrder.Status.CANCELLED)
        refund.assert_called_once()

    def test_instant_succeeded_without_confirmation_url_marks_paid(self):
        with patch(
            "shop.views.create_org_payment",
            return_value={
                "id": "yk-shop-instant",
                "confirmation_url": "",
                "status": "succeeded",
                "raw": {"id": "yk-shop-instant", "payment_method": {"id": "pm-1"}},
            },
        ):
            with patch("shop.notify.notify_new_shop_order"):
                with patch("shop.payments.mark_shop_order_paid") as mark_paid:
                    with patch("vmagazine.cards.upsert_saved_card_from_yookassa_payment"):
                        res = self.api.post(
                            "/api/shop/public/shop-pay-api/order/",
                            self._payload(),
                            format="json",
                        )
        self.assertEqual(res.status_code, 201, res.data)
        mark_paid.assert_called_once()
