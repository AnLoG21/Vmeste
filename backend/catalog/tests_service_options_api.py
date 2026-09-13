"""HTTP: service options create / patch / delete."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Service, ServiceCategory, ServiceOption
from users.models import User


class CatalogServiceOptionsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-svc-opts",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Options",
        )
        self.category = ServiceCategory.objects.create(
            provider=self.provider,
            name="Стрижки",
        )
        self.service = Service.objects.create(
            provider=self.provider,
            category=self.category,
            name="Стрижка",
            price=Decimal("1000"),
            duration_minutes=30,
            is_active=True,
        )
        self.api.force_authenticate(self.provider)

    def test_create_patch_delete_option(self):
        created = self.api.post(
            f"/api/catalog/services/{self.service.id}/options/",
            {
                "name": "Мытьё головы",
                "price": "200.00",
                "extra_minutes": 10,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        opt_id = created.data.get("id")
        self.assertTrue(opt_id)
        self.assertEqual(created.data.get("name"), "Мытьё головы")
        self.assertEqual(ServiceOption.objects.filter(service=self.service).count(), 1)

        patched = self.api.patch(
            f"/api/catalog/services/{self.service.id}/options/{opt_id}/",
            {"is_active": False, "price": "250.00"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertFalse(patched.data.get("is_active"))
        self.assertEqual(str(patched.data.get("price")), "250.00")

        deleted = self.api.delete(f"/api/catalog/services/{self.service.id}/options/{opt_id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(ServiceOption.objects.filter(service=self.service).count(), 0)

    def test_client_cannot_create_option(self):
        client = User.objects.create_user(
            username="client-no-opt",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.post(
            f"/api/catalog/services/{self.service.id}/options/",
            {"name": "X", "price": "1"},
            format="json",
        )
        self.assertIn(res.status_code, (403, 404))
