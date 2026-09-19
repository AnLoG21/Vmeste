"""HTTP: Вменю feed returns published recipes for authenticated user."""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import User
from vmenu.models import VmenuRecipe


class VmenuFeedApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.viewer = User.objects.create_user(
            username="vmenu-feed-viewer",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-feed-viewer@example.com",
        )
        self.author = User.objects.create_user(
            username="vmenu-feed-author",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-feed-author@example.com",
        )
        self.published = VmenuRecipe.objects.create(
            author=self.author,
            title="Борщ E2E Feed",
            description="Свекольный",
            status=VmenuRecipe.Status.PUBLISHED,
            published_at=timezone.now(),
            like_count=3,
        )
        VmenuRecipe.objects.create(
            author=self.author,
            title="Черновик не в ленте",
            status=VmenuRecipe.Status.DRAFT,
        )
        self.api.force_authenticate(self.viewer)

    def test_feed_lists_published_recipe(self):
        res = self.api.get("/api/vmenu/feed/")
        self.assertEqual(res.status_code, 200, res.data)
        items = res.data.get("items") or []
        titles = [i.get("title") for i in items]
        self.assertIn("Борщ E2E Feed", titles)
        self.assertNotIn("Черновик не в ленте", titles)
        hit = next(i for i in items if i.get("title") == "Борщ E2E Feed")
        self.assertEqual(hit.get("id"), self.published.id)
        self.assertIn("author", hit)

    def test_feed_requires_auth(self):
        self.api.force_authenticate(None)
        res = self.api.get("/api/vmenu/feed/")
        self.assertIn(res.status_code, (401, 403))
