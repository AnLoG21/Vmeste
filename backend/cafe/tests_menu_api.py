"""HTTP: cafe provider menu category/item CRUD."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from cafe.models import CafeMenuCategory, CafeMenuItem
from users.models import User


class CafeMenuApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="cafe-menu-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.CAFE_RESTAURANT,
            organization_name="Кафе Menu",
            organization_slug="cafe-menu-api",
        )
        self.api.force_authenticate(self.provider)

    def test_category_item_crud(self):
        cat = self.api.post(
            "/api/cafe/menu/categories/",
            {"name": "Супы", "is_novelties": False},
            format="json",
        )
        self.assertEqual(cat.status_code, 201, cat.data)
        cat_id = cat.data["id"]
        self.assertEqual(cat.data.get("name"), "Супы")
        self.assertEqual(CafeMenuCategory.objects.filter(provider=self.provider).count(), 1)

        item = self.api.post(
            "/api/cafe/menu/items/",
            {
                "category": cat_id,
                "name": "Борщ",
                "price": "450.00",
                "is_available": True,
            },
            format="json",
        )
        self.assertEqual(item.status_code, 201, item.data)
        item_id = item.data["id"]
        self.assertEqual(item.data.get("name"), "Борщ")

        patched = self.api.patch(
            f"/api/cafe/menu/items/{item_id}/",
            {"is_available": False, "price": "480.00"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertFalse(patched.data.get("is_available"))
        self.assertEqual(Decimal(str(patched.data.get("price"))), Decimal("480.00"))

        listed = self.api.get("/api/cafe/menu/categories/")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(len(listed.data[0].get("items") or []), 1)

        deleted = self.api.delete(f"/api/cafe/menu/items/{item_id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(CafeMenuItem.objects.filter(id=item_id).exists())

        del_cat = self.api.delete(f"/api/cafe/menu/categories/{cat_id}/")
        self.assertEqual(del_cat.status_code, 204)
        self.assertFalse(CafeMenuCategory.objects.filter(id=cat_id).exists())

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-cafe-menu",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.get("/api/cafe/menu/categories/")
        self.assertEqual(res.status_code, 403)
