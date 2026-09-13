"""HTTP: shop provider category/product CRUD."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import Product, ProductCategory
from users.models import User


class ShopMenuApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="shop-menu-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Магазин Menu",
            organization_slug="shop-menu-api",
        )
        self.api.force_authenticate(self.provider)

    def test_category_product_crud(self):
        pooled = self.api.post(
            "/api/shop/categories/from-pool/",
            {"path": [{"key": "e2e_root", "name": "Краски"}, {"key": "e2e_leaf", "name": "Стойкие"}]},
            format="json",
        )
        self.assertEqual(pooled.status_code, 201, pooled.data)
        leaf_id = pooled.data["leaf"]["id"]
        self.assertEqual(ProductCategory.objects.filter(provider=self.provider).count(), 2)

        product = self.api.post(
            "/api/shop/products/",
            {
                "category": leaf_id,
                "name": "Краска 7.1",
                "price": "1200.00",
                "unit": "шт",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(product.status_code, 201, product.data)
        product_id = product.data["id"]
        self.assertEqual(product.data.get("name"), "Краска 7.1")

        patched = self.api.patch(
            f"/api/shop/products/{product_id}/",
            {"is_active": False, "price": "1300.00"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertFalse(patched.data.get("is_active"))
        self.assertEqual(Decimal(str(patched.data.get("price"))), Decimal("1300.00"))

        listed = self.api.get("/api/shop/products/")
        self.assertEqual(listed.status_code, 200, listed.data)
        rows = listed.data if isinstance(listed.data, list) else listed.data.get("results") or []
        self.assertEqual(len(rows), 1)

        deleted = self.api.delete(f"/api/shop/products/{product_id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Product.objects.filter(id=product_id).exists())

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-shop-menu",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.post(
            "/api/shop/products/",
            {"name": "X", "price": "1"},
            format="json",
        )
        self.assertIn(res.status_code, (403, 400))
