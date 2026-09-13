"""HTTP: provider PATCH catalog service (price / duration / is_active)."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Service, ServiceCategory
from users.models import User


class CatalogServicePatchApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-svc-patch",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Patch",
        )
        self.category = ServiceCategory.objects.create(
            provider=self.provider,
            name="Стрижки",
        )
        self.service = Service.objects.create(
            provider=self.provider,
            category=self.category,
            name="Стрижка мужская",
            price=Decimal("0"),
            duration_minutes=30,
            is_active=False,
        )
        self.api.force_authenticate(self.provider)

    def test_patch_activate_and_price(self):
        res = self.api.patch(
            f"/api/catalog/services/{self.service.id}/",
            {
                "price": "1500.00",
                "duration_minutes": 45,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("is_active"))
        self.assertEqual(str(res.data.get("price")), "1500.00")
        self.assertEqual(res.data.get("duration_minutes"), 45)
        self.service.refresh_from_db()
        self.assertTrue(self.service.is_active)
        self.assertEqual(self.service.price, Decimal("1500.00"))
        self.assertEqual(self.service.duration_minutes, 45)

    def test_create_without_template_forbidden(self):
        res = self.api.post(
            "/api/catalog/services/",
            {
                "name": "Свободная услуга",
                "category": self.category.id,
                "price": "1000.00",
                "duration_minutes": 30,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403, res.data)
