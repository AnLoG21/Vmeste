"""HTTP: service photo upload / delete."""

from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Service, ServiceCategory, ServicePhoto
from users.models import User

_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


class CatalogServicePhotosApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-svc-photos",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Photos",
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

    def test_upload_and_delete_photo(self):
        upload = SimpleUploadedFile("svc.png", _PNG, content_type="image/png")
        res = self.api.post(
            f"/api/catalog/services/{self.service.id}/photos/",
            {"photos": upload},
            format="multipart",
        )
        self.assertEqual(res.status_code, 201, res.data)
        photos = res.data.get("photos") or []
        self.assertEqual(len(photos), 1, res.data)
        photo_id = photos[0].get("id")
        self.assertTrue(photo_id)
        self.assertEqual(ServicePhoto.objects.filter(service=self.service).count(), 1)

        deleted = self.api.delete(
            f"/api/catalog/services/{self.service.id}/photos/{photo_id}/",
        )
        self.assertEqual(deleted.status_code, 200, deleted.data)
        self.assertEqual(ServicePhoto.objects.filter(service=self.service).count(), 0)
