"""HTTP: GET/POST/DELETE /users/gallery/."""

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import ProviderGalleryPhoto, User
from users.org_profile import ORG_GALLERY_MAX_PHOTOS

_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


class ProviderGalleryApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-gallery-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Gallery",
        )
        self.api.force_authenticate(self.provider)

    def test_upload_list_delete(self):
        upload = SimpleUploadedFile("g.png", _PNG, content_type="image/png")
        res = self.api.post("/api/users/gallery/", {"image": upload}, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        photo_id = res.data.get("id")
        self.assertTrue(photo_id)
        self.assertEqual(ProviderGalleryPhoto.objects.filter(provider=self.provider).count(), 1)

        listed = self.api.get("/api/users/gallery/")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(listed.data.get("count"), 1)
        self.assertEqual(len(listed.data.get("photos") or []), 1)

        deleted = self.api.delete(f"/api/users/gallery/?id={photo_id}")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(ProviderGalleryPhoto.objects.filter(provider=self.provider).count(), 0)

    def test_upload_limit(self):
        for i in range(ORG_GALLERY_MAX_PHOTOS):
            ProviderGalleryPhoto.objects.create(
                provider=self.provider,
                image=SimpleUploadedFile(f"g{i}.png", _PNG, content_type="image/png"),
                sort_order=i + 1,
            )
        upload = SimpleUploadedFile("extra.png", _PNG, content_type="image/png")
        res = self.api.post("/api/users/gallery/", {"image": upload}, format="multipart")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data.get("code"), "gallery_limit_reached")

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-gallery",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.get("/api/users/gallery/")
        self.assertEqual(res.status_code, 403)
