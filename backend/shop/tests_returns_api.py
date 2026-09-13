"""HTTP: shop provider returns GET/PATCH (cash path, no YooKassa)."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import Product, ProductCategory, ShopOrder, ShopOrderItem
from users.models import User
from vmagazine.models import ReturnRequest


class ShopReturnsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="shop-returns-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Магазин Returns",
            organization_slug="shop-returns-api",
        )
        self.client_user = User.objects.create_user(
            username="client-shop-return",
            password="x",
            role=User.Role.CLIENT,
        )
        cat = ProductCategory.objects.create(provider=self.provider, name="Краски")
        product = Product.objects.create(
            provider=self.provider,
            category=cat,
            name="Краска 7.1",
            price=Decimal("1200.00"),
            is_active=True,
        )
        self.order = ShopOrder.objects.create(
            provider=self.provider,
            mode=ShopOrder.Mode.PICKUP,
            status=ShopOrder.Status.DONE,
            guest_name="Гость",
            items_total=Decimal("1200.00"),
            total=Decimal("1200.00"),
            yookassa_payment_id="",
        )
        self.item = ShopOrderItem.objects.create(
            order=self.order,
            product=product,
            name=product.name,
            unit_price=product.price,
            quantity=1,
            selected_size="M",
        )
        self.ret = ReturnRequest.objects.create(
            user=self.client_user,
            order=self.order,
            order_item=self.item,
            reason="Не подошёл размер",
            status=ReturnRequest.Status.PENDING,
        )
        self.ret2 = ReturnRequest.objects.create(
            user=self.client_user,
            order=self.order,
            order_item=self.item,
            reason="Брак",
            status=ReturnRequest.Status.PENDING,
        )
        self.api.force_authenticate(self.provider)

    def test_list_returns(self):
        res = self.api.get("/api/shop/returns/")
        self.assertEqual(res.status_code, 200, res.data)
        ids = {row["id"] for row in res.data}
        self.assertIn(self.ret.id, ids)
        self.assertIn(self.ret2.id, ids)
        row = next(r for r in res.data if r["id"] == self.ret.id)
        self.assertEqual(row["status"], "pending")
        self.assertEqual(row["product_name"], "Краска 7.1")
        self.assertEqual(row["selected_size"], "M")

    def test_approve_cash_then_done(self):
        approved = self.api.patch(
            "/api/shop/returns/",
            {"id": self.ret.id, "status": "approved"},
            format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data.get("status"), "approved")
        self.assertFalse(approved.data.get("refund_id"))
        self.ret.refresh_from_db()
        self.assertEqual(self.ret.status, ReturnRequest.Status.APPROVED)

        done = self.api.patch(
            "/api/shop/returns/",
            {"id": self.ret.id, "status": "done"},
            format="json",
        )
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(done.data.get("status"), "done")
        self.ret.refresh_from_db()
        self.assertEqual(self.ret.status, ReturnRequest.Status.DONE)

    def test_reject_with_note(self):
        res = self.api.patch(
            "/api/shop/returns/",
            {
                "id": self.ret2.id,
                "status": "rejected",
                "seller_note": "Не принимаем без бирки",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("status"), "rejected")
        self.assertEqual(res.data.get("seller_note"), "Не принимаем без бирки")
        self.ret2.refresh_from_db()
        self.assertEqual(self.ret2.status, ReturnRequest.Status.REJECTED)
        self.assertEqual(self.ret2.seller_note, "Не принимаем без бирки")

    def test_client_forbidden(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/shop/returns/")
        self.assertIn(res.status_code, (403, 404))
        patch = self.api.patch(
            "/api/shop/returns/",
            {"id": self.ret.id, "status": "approved"},
            format="json",
        )
        self.assertIn(patch.status_code, (403, 404))
