from unittest.mock import patch

from django.test import SimpleTestCase

from notifications.channels import send_telegram


class ChannelAdapterTests(SimpleTestCase):
    def test_send_telegram_requires_token_and_chat(self):
        self.assertFalse(send_telegram(bot_token="", chat_id="1", text="hi"))
        self.assertFalse(send_telegram(bot_token="tok", chat_id="", text="hi"))

    @patch("notifications.telegram_api.telegram_post")
    def test_send_telegram_ok(self, mock_post):
        mock_post.return_value = {"ok": True}
        self.assertTrue(send_telegram(bot_token="tok", chat_id="42", text="Привет"))
