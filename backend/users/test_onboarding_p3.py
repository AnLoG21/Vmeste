"""P3 onboarding: platform tour flag + setup checklist."""

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from users.setup_progress import build_setup_progress
from users.views import MeView


User = get_user_model()


class SetupProgressUnitTests(SimpleTestCase):
    def test_non_provider_empty(self):
        client = type("U", (), {"role": "client", "provider_sphere": "hair_salon"})()
        self.assertEqual(build_setup_progress(client), [])

    def test_salon_steps_shape(self):
        provider = type(
            "U",
            (),
            {
                "id": 1,
                "role": "provider",
                "provider_sphere": "hair_salon",
                "organization_latitude": None,
                "organization_longitude": None,
            },
        )()
        steps = build_setup_progress(provider)
        self.assertEqual(len(steps), 3)
        self.assertEqual(steps[0]["id"], "map_address")
        self.assertFalse(steps[0]["done"])
        self.assertEqual(steps[1]["view"], "services")
        self.assertEqual(steps[2]["view"], "intervals")

    def test_marketplaces_keys_step(self):
        provider = type(
            "U",
            (),
            {
                "id": 99,
                "role": "provider",
                "provider_sphere": "marketplaces",
                "organization_latitude": None,
                "organization_longitude": None,
            },
        )()
        steps = build_setup_progress(provider)
        self.assertEqual(steps[0]["id"], "marketplace_keys")
        self.assertEqual(steps[0]["view"], "marketplaces")


class PlatformTourMeApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.provider = User.objects.create_user(
            username="onboard-p3",
            email="onboard-p3@example.com",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон",
            organization_address="ул. Тест, 1",
        )

    def test_me_exposes_tour_flag_and_checklist(self):
        req = self.factory.get("/api/users/me/")
        force_authenticate(req, user=self.provider)
        resp = MeView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["platform_tour_completed"])
        self.assertIsInstance(resp.data.get("setup_progress"), list)
        self.assertEqual(len(resp.data["setup_progress"]), 3)

    def test_patch_platform_tour_completed(self):
        req = self.factory.patch(
            "/api/users/me/",
            {"platform_tour_completed": True},
            format="json",
        )
        force_authenticate(req, user=self.provider)
        resp = MeView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["platform_tour_completed"])
        self.provider.refresh_from_db()
        self.assertTrue(self.provider.platform_tour_completed)
