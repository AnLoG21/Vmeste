"""HTTP: Вменю create recipe + get detail."""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import User
from vmenu.models import VmenuIngredient, VmenuRecipe, VmenuStep


class VmenuRecipeApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="vmenu-recipe-author",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-recipe@example.com",
        )
        self.api.force_authenticate(self.user)

    def test_create_and_get_recipe(self):
        res = self.api.post(
            "/api/vmenu/recipes/",
            {"title": "Оливье E2E", "description": "Салат", "publish": True, "servings": 4},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        recipe_id = res.data.get("id")
        self.assertTrue(recipe_id)
        self.assertEqual(res.data.get("title"), "Оливье E2E")
        self.assertEqual(res.data.get("status"), VmenuRecipe.Status.PUBLISHED)

        detail = self.api.get(f"/api/vmenu/recipes/{recipe_id}/")
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data.get("title"), "Оливье E2E")
        self.assertEqual(detail.data.get("servings"), 4)

    def test_get_other_draft_hidden(self):
        other = User.objects.create_user(
            username="vmenu-other",
            password="x",
            role=User.Role.CLIENT,
            email="vmenu-other@example.com",
        )
        draft = VmenuRecipe.objects.create(
            author=other,
            title="Секрет",
            status=VmenuRecipe.Status.DRAFT,
        )
        res = self.api.get(f"/api/vmenu/recipes/{draft.id}/")
        self.assertEqual(res.status_code, 404)

    def test_owner_can_get_own_draft(self):
        draft = VmenuRecipe.objects.create(
            author=self.user,
            title="Мой черновик",
            status=VmenuRecipe.Status.DRAFT,
        )
        VmenuIngredient.objects.create(recipe=draft, name="Картофель", amount="3", unit="шт", sort_order=0)
        VmenuStep.objects.create(recipe=draft, text="Почистить", sort_order=0)
        res = self.api.get(f"/api/vmenu/recipes/{draft.id}/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("title"), "Мой черновик")
        self.assertEqual(len(res.data.get("ingredients") or []), 1)
