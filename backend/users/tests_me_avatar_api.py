"""HTTP: POST /users/me/ avatar upload and clear_avatar."""

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

# 1×1 PNG
_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


class MeAvatarApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="client-avatar-api",
            password="x",
            role=User.Role.CLIENT,
            email="avatar@example.com",
        )
        self.api.force_authenticate(self.user)

    def test_upload_avatar(self):
        upload = SimpleUploadedFile("avatar.png", _PNG, content_type="image/png")
        res = self.api.post("/api/users/me/", {"avatar": upload}, format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.avatar_image)
        self.assertTrue(res.data.get("avatar_url") or res.data.get("avatar_thumb_url"))

    def test_clear_avatar(self):
        self.user.avatar_image.save("seed.png", SimpleUploadedFile("seed.png", _PNG, content_type="image/png"), save=True)
        self.assertTrue(self.user.avatar_image)
        res = self.api.post("/api/users/me/", {"clear_avatar": "1"}, format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar_image)
        self.assertFalse(res.data.get("avatar_url"))

    def test_upload_without_file(self):
        res = self.api.post("/api/users/me/", {}, format="multipart")
        self.assertEqual(res.status_code, 400, res.data)
