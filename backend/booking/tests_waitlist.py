from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from booking.waitlist import notify_waitlist_after_slot_freed


class WaitlistNotifyTests(SimpleTestCase):
    @patch("booking.waitlist.WaitlistEntry.objects")
    def test_returns_zero_when_queue_empty(self, mock_objects):
        chain = mock_objects.filter.return_value
        chain.select_related.return_value.order_by.return_value.first.return_value = None
        self.assertEqual(notify_waitlist_after_slot_freed(provider_id=1), 0)
        mock_objects.filter.assert_called_once()

    @patch("notifications.delivery._fanout_user_channels")
    @patch("notifications.delivery.get_or_create_messaging")
    @patch("notifications.push.notify_users")
    @patch("booking.waitlist.WaitlistEntry.objects")
    def test_notifies_first_waiting_client(self, mock_objects, mock_notify, mock_messaging, mock_fanout):
        entry = MagicMock()
        entry.id = 7
        entry.client_id = 3
        entry.provider_id = 1
        entry.service_id = 2
        entry.provider.organization_name = "Салон"
        entry.service.name = "Стрижка"

        ordered_qs = MagicMock()
        service_filtered_qs = MagicMock()
        ordered_qs.filter.return_value = service_filtered_qs
        service_filtered_qs.first.return_value = entry

        chain = mock_objects.filter.return_value
        chain.select_related.return_value.order_by.return_value = ordered_qs
        mock_messaging.return_value = MagicMock()

        count = notify_waitlist_after_slot_freed(provider_id=1, service_id=2)

        self.assertEqual(count, 1)
        mock_notify.assert_called_once()
        entry.save.assert_called_once()
