"""HTTP: Вмагазине my-orders, addresses, returns smoke."""

from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import Product, ShopOrder, ShopOrderItem
from users.models import User
from vmagazine.models import DeliveryAddress, ReturnRequest

_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


class VmagazineOrdersReturnsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.buyer = User.objects.create_user(
            username="vmag-ord-buyer",
            password="x",
            role=User.Role.CLIENT,
            email="vmag-ord-buyer@example.com",
        )
        self.shop = User.objects.create_user(
            username="vmag-ord-shop",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Лавка Ord",
            organization_slug="vmag-ord-shop",
        )
        self.product = Product.objects.create(
            provider=self.shop,
            name="Товар Ord",
            price=Decimal("450.00"),
            stock_qty=Decimal("8"),
            is_active=True,
        )
        self.order = ShopOrder.objects.create(
            provider=self.shop,
            client=self.buyer,
            mode=ShopOrder.Mode.PICKUP,
            status=ShopOrder.Status.DONE,
            guest_name="Buyer",
            items_total=Decimal("450.00"),
            total=Decimal("450.00"),
        )
        self.item = ShopOrderItem.objects.create(
            order=self.order,
            product=self.product,
            name=self.product.name,
            unit_price=self.product.price,
            quantity=1,
        )
        self.api.force_authenticate(self.buyer)

    def test_my_orders_lists_done_order(self):
        res = self.api.get("/api/vmagazine/my-orders/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0].get("id"), self.order.id)
        self.assertEqual(res.data[0].get("status"), ShopOrder.Status.DONE)

    def test_addresses_get_and_post(self):
        empty = self.api.get("/api/vmagazine/addresses/")
        self.assertEqual(empty.status_code, 200, empty.data)
        self.assertEqual(empty.data, [])

        created = self.api.post(
            "/api/vmagazine/addresses/",
            {"address": "ул. Тест, 1", "label": "Дом", "is_default": True},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(created.data.get("id"))
        self.assertTrue(
            DeliveryAddress.objects.filter(user=self.buyer, address="ул. Тест, 1").exists()
        )

        listed = self.api.get("/api/vmagazine/addresses/")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0].get("address"), "ул. Тест, 1")

    def test_returns_get_and_post(self):
        empty = self.api.get("/api/vmagazine/returns/")
        self.assertEqual(empty.status_code, 200, empty.data)
        self.assertEqual(empty.data, [])

        photo = SimpleUploadedFile("ret.png", _PNG, content_type="image/png")
        created = self.api.post(
            "/api/vmagazine/returns/",
            {
                "order_id": self.order.id,
                "order_item_id": self.item.id,
                "reason": "Не подошёл цвет",
                "photos": photo,
            },
            format="multipart",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(
            ReturnRequest.objects.filter(
                user=self.buyer, order=self.order, order_item=self.item
            ).exists()
        )

        listed = self.api.get("/api/vmagazine/returns/")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0].get("product_name"), "Товар Ord")
        self.assertEqual(listed.data[0].get("reason"), "Не подошёл цвет")
