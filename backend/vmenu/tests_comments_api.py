"""HTTP: Вменю recipe comments + comment like."""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import User
from vmenu.models import VmenuComment, VmenuCommentLike, VmenuRecipe


class VmenuCommentsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.viewer = User.objects.create_user(
            username="vmenu-cmt-viewer",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-cmt-viewer@example.com",
        )
        self.author = User.objects.create_user(
            username="vmenu-cmt-author",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-cmt-author@example.com",
        )
        self.recipe = VmenuRecipe.objects.create(
            author=self.author,
            title="Пирог Comment",
            description="С яблоками",
            status=VmenuRecipe.Status.PUBLISHED,
            published_at=timezone.now(),
            comment_count=0,
        )
        self.api.force_authenticate(self.viewer)

    def test_post_comment_and_like(self):
        created = self.api.post(
            f"/api/vmenu/recipes/{self.recipe.id}/comments/",
            {"text": "Очень вкусно", "rating": 0},
            format="json",
        )
        self.assertEqual(created.status_code, 200, created.data)
        self.assertEqual(created.data.get("text"), "Очень вкусно")
        comment_id = created.data.get("id")
        self.assertTrue(comment_id)
        self.assertTrue(
            VmenuComment.objects.filter(pk=comment_id, recipe=self.recipe, user=self.viewer).exists()
        )

        like = self.api.post(f"/api/vmenu/recipes/{self.recipe.id}/comments/{comment_id}/like/")
        self.assertEqual(like.status_code, 200, like.data)
        self.assertTrue(like.data.get("liked"))
        self.assertEqual(like.data.get("like_count"), 1)
        self.assertTrue(VmenuCommentLike.objects.filter(user=self.viewer, comment_id=comment_id).exists())

        unlike = self.api.delete(f"/api/vmenu/recipes/{self.recipe.id}/comments/{comment_id}/like/")
        self.assertEqual(unlike.status_code, 200, unlike.data)
        self.assertFalse(unlike.data.get("liked"))
        self.assertEqual(unlike.data.get("like_count"), 0)

    def test_comment_requires_published_recipe(self):
        draft = VmenuRecipe.objects.create(
            author=self.author,
            title="Черновик",
            status=VmenuRecipe.Status.DRAFT,
        )
        res = self.api.post(
            f"/api/vmenu/recipes/{draft.id}/comments/",
            {"text": "нет", "rating": 0},
            format="json",
        )
        self.assertEqual(res.status_code, 404)
