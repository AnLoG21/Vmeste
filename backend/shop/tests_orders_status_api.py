"""HTTP: shop provider order status PATCH (pickup)."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import Product, ProductCategory, ShopOrder, ShopOrderItem
from users.models import User


class ShopOrdersStatusApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="shop-orders-status",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Магазин Orders",
            organization_slug="shop-orders-status",
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
            status=ShopOrder.Status.PAID,
            guest_name="Гость",
            items_total=Decimal("1200.00"),
            total=Decimal("1200.00"),
        )
        ShopOrderItem.objects.create(
            order=self.order,
            product=product,
            name=product.name,
            unit_price=product.price,
            quantity=1,
        )
        self.api.force_authenticate(self.provider)

    def test_status_assembling_ready_done(self):
        assembling = self.api.patch(
            f"/api/shop/orders/{self.order.id}/",
            {"status": "assembling"},
            format="json",
        )
        self.assertEqual(assembling.status_code, 200, assembling.data)
        self.assertEqual(assembling.data.get("status"), "assembling")

        ready = self.api.patch(
            f"/api/shop/orders/{self.order.id}/",
            {"status": "ready"},
            format="json",
        )
        self.assertEqual(ready.status_code, 200, ready.data)
        self.assertEqual(ready.data.get("status"), "ready")

        done = self.api.patch(
            f"/api/shop/orders/{self.order.id}/",
            {"status": "done"},
            format="json",
        )
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(done.data.get("status"), "done")
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, ShopOrder.Status.DONE)

    def test_invalid_status_ignored(self):
        # Current API silently ignores unknown status and returns 200.
        res = self.api.patch(
            f"/api/shop/orders/{self.order.id}/",
            {"status": "not_a_status"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("status"), "paid")
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, ShopOrder.Status.PAID)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-shop-orders",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.patch(
            f"/api/shop/orders/{self.order.id}/",
            {"status": "assembling"},
            format="json",
        )
        self.assertIn(res.status_code, (403, 404))
