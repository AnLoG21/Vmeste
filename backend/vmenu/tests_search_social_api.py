"""HTTP: Вменю search / like / save / follow / book."""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import User
from vmenu.models import VmenuFollow, VmenuLike, VmenuRecipe, VmenuSave


class VmenuSearchSocialApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.viewer = User.objects.create_user(
            username="vmenu-social-viewer",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-social-viewer@example.com",
        )
        self.author = User.objects.create_user(
            username="vmenu-social-author",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-social-author@example.com",
        )
        self.recipe = VmenuRecipe.objects.create(
            author=self.author,
            title="Оливье Social",
            description="Салат на праздник",
            status=VmenuRecipe.Status.PUBLISHED,
            published_at=timezone.now(),
            like_count=0,
            save_count=0,
        )
        self.api.force_authenticate(self.viewer)

    def test_search_by_query(self):
        res = self.api.get("/api/vmenu/search/", {"q": "Оливье"})
        self.assertEqual(res.status_code, 200, res.data)
        items = res.data.get("items") or []
        titles = [i.get("title") for i in items]
        self.assertIn("Оливье Social", titles)

    def test_like_and_unlike(self):
        like = self.api.post(f"/api/vmenu/recipes/{self.recipe.id}/like/")
        self.assertEqual(like.status_code, 200, like.data)
        self.assertTrue(like.data.get("liked"))
        self.assertEqual(like.data.get("like_count"), 1)
        self.assertTrue(VmenuLike.objects.filter(user=self.viewer, recipe=self.recipe).exists())

        unlike = self.api.delete(f"/api/vmenu/recipes/{self.recipe.id}/like/")
        self.assertEqual(unlike.status_code, 200, unlike.data)
        self.assertFalse(unlike.data.get("liked"))
        self.assertEqual(unlike.data.get("like_count"), 0)

    def test_save_and_book(self):
        save = self.api.post(f"/api/vmenu/recipes/{self.recipe.id}/save/")
        self.assertEqual(save.status_code, 200, save.data)
        self.assertTrue(save.data.get("saved"))
        self.assertEqual(save.data.get("save_count"), 1)
        self.assertTrue(VmenuSave.objects.filter(user=self.viewer, recipe=self.recipe).exists())

        book = self.api.get("/api/vmenu/book/")
        self.assertEqual(book.status_code, 200, book.data)
        titles = [i.get("title") for i in (book.data.get("items") or [])]
        self.assertIn("Оливье Social", titles)

    def test_follow_user(self):
        follow = self.api.post(f"/api/vmenu/users/{self.author.id}/follow/")
        self.assertEqual(follow.status_code, 200, follow.data)
        self.assertTrue(follow.data.get("following"))
        self.assertTrue(
            VmenuFollow.objects.filter(follower=self.viewer, following=self.author).exists()
        )

        unfollow = self.api.delete(f"/api/vmenu/users/{self.author.id}/follow/")
        self.assertEqual(unfollow.status_code, 200, unfollow.data)
        self.assertFalse(unfollow.data.get("following"))
