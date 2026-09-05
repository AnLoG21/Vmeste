"""Card design starter canvas + API seed/CRUD."""

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from marketplaces.card_designs import (
    STARTER_DESIGNS,
    build_starter_canvas_json,
    has_canvas_scene,
    normalize_style,
)
from marketplaces.models import MarketplaceCardDesign
from marketplaces.views import MarketplaceCardDesignView


User = get_user_model()


class StarterCanvasUnitTests(SimpleTestCase):
    def test_hero_has_roles_and_placeholders(self):
        canvas = build_starter_canvas_json("hero")
        self.assertTrue(has_canvas_scene(canvas))
        roles = {o.get("vmRole") for o in canvas["objects"] if o.get("vmRole")}
        self.assertIn("brandBar", roles)
        self.assertIn("productPhoto", roles)
        self.assertIn("productName", roles)
        self.assertIn("productPrice", roles)
        self.assertIn("productBrand", roles)
        texts = [o.get("text") for o in canvas["objects"] if o.get("type") == "IText"]
        self.assertIn("{{name}}", texts)
        self.assertIn("{{price}}", texts)
        self.assertIn("{{brand}}", texts)

    def test_benefits_and_specs_layouts(self):
        benefits = build_starter_canvas_json("benefits", {"accent": "#123456"})
        self.assertTrue(has_canvas_scene(benefits))
        self.assertEqual(benefits["objects"][0]["fill"], "#123456")
        specs = build_starter_canvas_json("specs")
        self.assertTrue(has_canvas_scene(specs))
        roles = {o.get("vmRole") for o in specs["objects"] if o.get("vmRole")}
        self.assertIn("productPhoto", roles)

    def test_empty_canvas_rejected(self):
        self.assertFalse(has_canvas_scene({}))
        self.assertFalse(has_canvas_scene({"objects": []}))
        self.assertFalse(has_canvas_scene(None))

    def test_starters_cover_three_layouts(self):
        layouts = {d["layout"] for d in STARTER_DESIGNS}
        self.assertEqual(layouts, {"hero", "benefits", "specs"})
        for item in STARTER_DESIGNS:
            style = normalize_style(item.get("style"))
            canvas = build_starter_canvas_json(item["layout"], style)
            self.assertTrue(has_canvas_scene(canvas), item["name"])


class CardDesignApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.provider = User.objects.create_user(
            username="mp_card",
            email="mp_card@example.com",
            password="test-pass-123",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.MARKETPLACES,
        )

    def test_seed_creates_canvas_scenes(self):
        req = self.factory.post("/api/marketplaces/card-designs/", {"seed": True}, format="json")
        force_authenticate(req, user=self.provider)
        resp = MarketplaceCardDesignView.as_view()(req)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(len(resp.data["results"]), 3)
        for row in resp.data["results"]:
            self.assertTrue(has_canvas_scene(row["canvas"]), row["name"])
            db = MarketplaceCardDesign.objects.get(id=row["id"])
            self.assertTrue(has_canvas_scene(db.canvas))

    def test_create_without_canvas_gets_starter(self):
        req = self.factory.post(
            "/api/marketplaces/card-designs/",
            {"name": "Свой", "layout": "hero"},
            format="json",
        )
        force_authenticate(req, user=self.provider)
        resp = MarketplaceCardDesignView.as_view()(req)
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(has_canvas_scene(resp.data["canvas"]))

    def test_patch_canvas_round_trip(self):
        seed = self.factory.post("/api/marketplaces/card-designs/", {"seed": True}, format="json")
        force_authenticate(seed, user=self.provider)
        created = MarketplaceCardDesignView.as_view()(seed)
        design_id = created.data["results"][0]["id"]
        custom = {
            "version": "6.0.0",
            "objects": [{"type": "Rect", "left": 0, "top": 0, "width": 10, "height": 10, "vmRole": "brandBar"}],
            "background": "#ffffff",
        }
        req = self.factory.patch(
            f"/api/marketplaces/card-designs/{design_id}/",
            {"canvas": custom, "name": "Updated"},
            format="json",
        )
        force_authenticate(req, user=self.provider)
        resp = MarketplaceCardDesignView.as_view()(req, pk=design_id)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["name"], "Updated")
        self.assertEqual(resp.data["canvas"]["objects"][0]["vmRole"], "brandBar")
        db = MarketplaceCardDesign.objects.get(id=design_id)
        self.assertEqual(db.canvas["objects"][0]["vmRole"], "brandBar")
