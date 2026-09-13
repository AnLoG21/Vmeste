"""HTTP: provider booking message templates via PATCH /users/me/."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User


class BookingMessagesApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-booking-msgs",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Messages",
        )
        self.api.force_authenticate(self.provider)

    def test_patch_booking_message_templates(self):
        res = self.api.patch(
            "/api/users/me/",
            {
                "booking_confirm_message_default": "Подтверждено на {date}",
                "booking_cancel_message_default": "Отменено {date}",
                "booking_done_message_default": "Спасибо за визит {date}",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("booking_confirm_message_default"), "Подтверждено на {date}")
        self.assertEqual(res.data.get("booking_cancel_message_default"), "Отменено {date}")
        self.assertEqual(res.data.get("booking_done_message_default"), "Спасибо за визит {date}")
        self.provider.refresh_from_db()
        self.assertEqual(self.provider.booking_confirm_message_default, "Подтверждено на {date}")
        self.assertEqual(self.provider.booking_done_message_default, "Спасибо за визит {date}")
