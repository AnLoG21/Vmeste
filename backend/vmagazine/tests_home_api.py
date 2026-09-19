"""HTTP: Вмагазине home feed + product detail."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import Product
from users.models import User


class VmagazineHomeApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.buyer = User.objects.create_user(
            username="vmag-home-buyer",
            password="x",
            role=User.Role.CLIENT,
            email="vmag-home-buyer@example.com",
        )
        self.shop = User.objects.create_user(
            username="vmag-home-shop",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Лавка Home",
            organization_slug="vmag-home-shop",
        )
        self.product = Product.objects.create(
            provider=self.shop,
            name="Кружка E2E Home",
            price=Decimal("350.00"),
            stock_qty=Decimal("20"),
            is_active=True,
            view_count=5,
        )
        self.api.force_authenticate(self.buyer)

    def test_home_lists_recommended_product(self):
        res = self.api.get("/api/vmagazine/home/")
        self.assertEqual(res.status_code, 200, res.data)
        recommended = res.data.get("recommended") or []
        names = [p.get("name") for p in recommended]
        self.assertIn("Кружка E2E Home", names)
        hit = next(p for p in recommended if p.get("name") == "Кружка E2E Home")
        self.assertEqual(hit.get("id"), self.product.id)

    def test_product_detail(self):
        res = self.api.get(f"/api/vmagazine/products/{self.product.id}/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("name"), "Кружка E2E Home")
        self.assertEqual(str(res.data.get("price")), "350.00")

    def test_home_requires_auth(self):
        self.api.force_authenticate(None)
        res = self.api.get("/api/vmagazine/home/")
        self.assertIn(res.status_code, (401, 403))
