"""HTTP: Вмагазине favorites (shops) + product-likes list."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import Product
from users.models import User
from vmagazine.models import ProductLike, ShopFavorite


class VmagazineFavoritesApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.buyer = User.objects.create_user(
            username="vmag-fav-buyer",
            password="x",
            role=User.Role.CLIENT,
            email="vmag-fav-buyer@example.com",
        )
        self.shop = User.objects.create_user(
            username="vmag-fav-shop",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Лавка Fav",
            organization_slug="vmag-fav-shop",
        )
        self.product = Product.objects.create(
            provider=self.shop,
            name="Товар Fav",
            price=Decimal("99.00"),
            stock_qty=Decimal("5"),
            is_active=True,
        )
        self.api.force_authenticate(self.buyer)

    def test_favorites_list_shop(self):
        ShopFavorite.objects.create(user=self.buyer, provider=self.shop)
        res = self.api.get("/api/vmagazine/favorites/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data), 1)
        provider = res.data[0].get("provider") or {}
        self.assertEqual(provider.get("id"), self.shop.id)
        self.assertTrue(provider.get("is_favorite"))

    def test_product_likes_list(self):
        ProductLike.objects.create(user=self.buyer, product=self.product)
        res = self.api.get("/api/vmagazine/product-likes/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0].get("id"), self.product.id)
        self.assertEqual(res.data[0].get("name"), "Товар Fav")
        self.assertTrue(res.data[0].get("liked"))

    def test_favorites_requires_auth(self):
        self.api.force_authenticate(None)
        res = self.api.get("/api/vmagazine/favorites/")
        self.assertIn(res.status_code, (401, 403))
