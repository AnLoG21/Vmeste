"""HTTP: inspection report create (service_center draft)."""

from django.test import TestCase
from rest_framework.test import APIClient

from inspections.models import InspectionReport
from users.models import User


class InspectionCreateApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="sto-create-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SERVICE_CENTER,
            organization_name="СТО Create",
            organization_slug="sto-create-api",
        )
        self.client_user = User.objects.create_user(
            username="client-sto-create",
            password="x",
            role=User.Role.CLIENT,
            first_name="Тест",
            last_name="Клиент",
        )
        self.api.force_authenticate(self.provider)

    def test_create_draft(self):
        res = self.api.post(
            "/api/inspections/reports/",
            {
                "client": self.client_user.id,
                "vehicle_title": "Hyundai Solaris",
                "vehicle_plate": "А123ВС77",
                "vehicle_vin": "XWEHXXXXXXXXXXXXX",
                "notes": "Осмотр приёмки",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("status"), "draft")
        self.assertEqual(res.data.get("client"), self.client_user.id)
        self.assertEqual(res.data.get("vehicle_title"), "Hyundai Solaris")
        self.assertEqual(res.data.get("vehicle_plate"), "А123ВС77")
        self.assertEqual(res.data.get("items"), [])
        self.assertTrue(InspectionReport.objects.filter(pk=res.data["id"], provider=self.provider).exists())

    def test_salon_forbidden(self):
        salon = User.objects.create_user(
            username="salon-no-inspections",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
        )
        self.api.force_authenticate(salon)
        res = self.api.post(
            "/api/inspections/reports/",
            {"client": self.client_user.id, "vehicle_title": "X"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
