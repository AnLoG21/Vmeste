"""HTTP: Вмагазине cart add + list."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import Product
from users.models import User
from vmagazine.models import CartItem


class VmagazineCartApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.buyer = User.objects.create_user(
            username="vmag-cart-buyer",
            password="x",
            role=User.Role.CLIENT,
            email="vmag-cart-buyer@example.com",
        )
        self.shop = User.objects.create_user(
            username="vmag-cart-shop",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Лавка Cart",
            organization_slug="vmag-cart-shop",
        )
        self.product = Product.objects.create(
            provider=self.shop,
            name="Чашка E2E Cart",
            price=Decimal("199.00"),
            stock_qty=Decimal("10"),
            is_active=True,
        )
        self.api.force_authenticate(self.buyer)

    def test_add_and_list_cart(self):
        add = self.api.post(
            "/api/vmagazine/cart/",
            {"product_id": self.product.id, "quantity": 2},
            format="json",
        )
        self.assertIn(add.status_code, (200, 201), add.data)
        self.assertEqual(add.data.get("quantity"), 2)
        self.assertTrue(CartItem.objects.filter(user=self.buyer, product=self.product).exists())

        listing = self.api.get("/api/vmagazine/cart/")
        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertEqual(len(listing.data), 1)
        self.assertEqual(listing.data[0].get("quantity"), 2)
        self.assertEqual(listing.data[0].get("product", {}).get("id"), self.product.id)
