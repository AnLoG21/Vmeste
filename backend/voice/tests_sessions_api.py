"""HTTP: voice sessions list for provider."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User
from voice.models import ProviderVoiceSettings, VoiceCallSession


class VoiceSessionsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="voice-sess-provider",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Voice Sess",
        )
        self.client_user = User.objects.create_user(
            username="voice-sess-client",
            password="x",
            role=User.Role.CLIENT,
            email="voice-sess-client@example.com",
        )
        ProviderVoiceSettings.objects.create(
            provider=self.provider,
            enabled=True,
            legal_ack=True,
        )
        self.session = VoiceCallSession.objects.create(
            provider=self.provider,
            caller_phone="+79001110000",
        )

    def test_provider_lists_sessions(self):
        self.api.force_authenticate(self.provider)
        res = self.api.get("/api/voice/sessions/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(isinstance(res.data, list))
        ids = [row.get("id") for row in res.data]
        self.assertIn(self.session.id, ids)

    def test_client_forbidden(self):
        self.api.force_authenticate(self.client_user)
        res = self.api.get("/api/voice/sessions/")
        self.assertEqual(res.status_code, 403)

    def test_session_turn_with_token(self):
        vs = ProviderVoiceSettings.objects.get(provider=self.provider)
        res = self.api.post(
            f"/api/voice/session/{self.session.id}/turn/",
            {"text": ""},
            format="json",
            HTTP_X_VOICE_TOKEN=vs.webhook_token,
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("say"))
