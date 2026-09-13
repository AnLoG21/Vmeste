"""Demo mailboxes must never be sent via SMTP."""

from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from users.email_service import (
    is_demo_mailbox,
    send_booking_notification_email,
    send_cafe_order_receipt_email,
    send_subscription_reminder_email,
)


class DemoMailboxGuardTests(SimpleTestCase):
    def test_is_demo_mailbox_patterns(self):
        self.assertTrue(is_demo_mailbox("demo_auto_staff_1@vsevmeste.space"))
        self.assertTrue(is_demo_mailbox("demo.auto@vsevmeste.space"))
        self.assertTrue(is_demo_mailbox("Demo_Salon_Client_1@VseVmeste.Space"))
        self.assertFalse(is_demo_mailbox("owner@vsevmeste.space"))
        self.assertFalse(is_demo_mailbox("client@gmail.com"))
        self.assertFalse(is_demo_mailbox(""))

    @override_settings(EMAIL_HOST_USER="smtp-user", EMAIL_HOST_PASSWORD="secret")
    @patch("users.email_service.EmailMultiAlternatives")
    def test_booking_email_skips_demo_address(self, msg_cls):
        ok = send_booking_notification_email(
            to="demo_auto_staff_1@vsevmeste.space",
            subject="Напоминание",
            text_body="Запись завтра",
        )
        self.assertFalse(ok)
        msg_cls.assert_not_called()

    @override_settings(EMAIL_HOST_USER="smtp-user", EMAIL_HOST_PASSWORD="secret")
    @patch("users.email_service.EmailMultiAlternatives")
    def test_cafe_receipt_skips_demo_address(self, msg_cls):
        ok = send_cafe_order_receipt_email(
            email="demo_cafe_client_1@vsevmeste.space",
            organization_name="Кафе",
            order_id=1,
            lines=["Борщ × 1"],
            total="500 ₽",
        )
        self.assertFalse(ok)
        msg_cls.assert_not_called()

    @override_settings(EMAIL_HOST_USER="smtp-user", EMAIL_HOST_PASSWORD="secret")
    @patch("users.email_service.EmailMultiAlternatives")
    def test_subscription_reminder_skips_demo_user_email(self, msg_cls):
        class U:
            email = "demo.salon@vsevmeste.space"
            first_name = "Анна"
            username = "demo_salon"

        ok = send_subscription_reminder_email(
            U(),
            days_left=3,
            period_end=None,
            plan_name="Бизнес",
        )
        self.assertFalse(ok)
        msg_cls.assert_not_called()
