from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase


class PrivateScenarioReplyApiTests(APITestCase):
    def test_requires_fields(self):
        res = self.client.post("/api/users/private-scenario-reply/", {}, format="json")
        self.assertEqual(res.status_code, 400)

    @override_settings(TELEGRAM_BOT_TOKEN="", TELEGRAM_PRIVATE_NOTIFY_CHAT_ID="")
    def test_unconfigured_returns_ok_false(self):
        res = self.client.post(
            "/api/users/private-scenario-reply/",
            {
                "page": "lubimaya_arinochka",
                "scenario": "Точно?",
                "answer": "Да",
                "step": "sure",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["ok"])

    @override_settings(TELEGRAM_BOT_TOKEN="tok", TELEGRAM_PRIVATE_NOTIFY_CHAT_ID="42")
    @patch("notifications.channels.send_telegram", return_value=True)
    def test_sends_log_line(self, mock_send):
        res = self.client.post(
            "/api/users/private-scenario-reply/",
            {
                "page": "lubimaya_arinochka",
                "scenario": "Сможешь ли ты меня простить?",
                "answer": "Да",
                "step": "forgive",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["ok"])
        mock_send.assert_called_once()
        kwargs = mock_send.call_args.kwargs
        self.assertEqual(kwargs["chat_id"], "42")
        self.assertIn("scenario: Сможешь ли ты меня простить?", kwargs["text"])
        self.assertIn("answer: Да", kwargs["text"])
