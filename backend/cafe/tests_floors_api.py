"""HTTP: cafe provider floors and tables CRUD."""

from django.test import TestCase
from rest_framework.test import APIClient

from cafe.models import CafeFloorPlan, CafeTable
from users.models import User


class CafeFloorsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="cafe-floors-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.CAFE_RESTAURANT,
            organization_name="Кафе Floors",
            organization_slug="cafe-floors-api",
        )
        self.api.force_authenticate(self.provider)

    def test_floor_and_table_crud(self):
        floor = self.api.post(
            "/api/cafe/floors/",
            {"name": "Зал 1", "drawings": []},
            format="json",
        )
        self.assertEqual(floor.status_code, 201, floor.data)
        floor_id = floor.data["id"]
        self.assertEqual(floor.data.get("name"), "Зал 1")
        self.assertEqual(CafeFloorPlan.objects.filter(provider=self.provider).count(), 1)

        table = self.api.post(
            f"/api/cafe/floors/{floor_id}/tables/",
            {
                "label": "Стол 1",
                "x": 40,
                "y": 40,
                "width": 88,
                "height": 88,
                "seats": 4,
                "shape": "round",
                "rotation": 0,
                "pin_code": "123456",
            },
            format="json",
        )
        self.assertEqual(table.status_code, 201, table.data)
        table_id = table.data["id"]
        self.assertEqual(table.data.get("shape"), "round")
        self.assertTrue(table.data.get("public_token"))
        self.assertEqual(CafeTable.objects.filter(floor_plan_id=floor_id).count(), 1)

        listed = self.api.get("/api/cafe/floors/")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(len(listed.data[0].get("tables") or []), 1)

        deleted_table = self.api.delete(f"/api/cafe/tables/{table_id}/")
        self.assertEqual(deleted_table.status_code, 204)
        self.assertFalse(CafeTable.objects.filter(id=table_id).exists())

        floor2 = self.api.post(
            "/api/cafe/floors/",
            {"name": "Зал 2", "drawings": []},
            format="json",
        )
        self.assertEqual(floor2.status_code, 201, floor2.data)

        deleted_floor = self.api.delete(f"/api/cafe/floors/{floor_id}/")
        self.assertEqual(deleted_floor.status_code, 204)
        self.assertFalse(CafeFloorPlan.objects.filter(id=floor_id).exists())
        self.assertEqual(CafeFloorPlan.objects.filter(provider=self.provider).count(), 1)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-cafe-floors",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.get("/api/cafe/floors/")
        self.assertEqual(res.status_code, 403)
