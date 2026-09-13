"""HTTP: provider reply, mark-seen, unread-count for reviews."""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from booking.models import AvailabilitySlot, Booking
from catalog.models import Service
from reviews.models import Review, ReviewReply
from users.models import User


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class ProviderReviewReplyApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-review-reply",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Reply",
        )
        self.client_user = User.objects.create_user(
            username="client-review-reply",
            password="x",
            role=User.Role.CLIENT,
            first_name="Клиент",
            last_name="Отзыв",
        )
        self.other = User.objects.create_user(
            username="other-provider-reply",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Чужой",
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Стрижка",
            duration_minutes=30,
            price=Decimal("1000.00"),
            is_active=True,
        )
        start = timezone.now() - timedelta(hours=2)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        booking = Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=Booking.Status.DONE,
            payment_status="paid",
        )
        self.review = Review.objects.create(
            provider=self.provider,
            client=self.client_user,
            booking=booking,
            rating=5,
            text="Супер",
        )
        self.api.force_authenticate(self.provider)

    def test_reply_and_mark_seen(self):
        unread = self.api.get("/api/reviews/unread-count/")
        self.assertEqual(unread.status_code, 200, unread.data)
        self.assertEqual(unread.data.get("count"), 1)

        reply = self.api.post(
            f"/api/reviews/{self.review.id}/reply/",
            {"text": "Спасибо за визит!", "publish_reply": True, "via_chat": False},
            format="json",
        )
        self.assertEqual(reply.status_code, 200, reply.data)
        self.assertEqual(reply.data.get("reply", {}).get("text"), "Спасибо за визит!")
        self.assertTrue(ReviewReply.objects.filter(review=self.review).exists())

        marked = self.api.post("/api/reviews/mark-seen/", {}, format="json")
        self.assertEqual(marked.status_code, 200, marked.data)
        self.assertEqual(marked.data.get("marked"), 1)
        self.review.refresh_from_db()
        self.assertIsNotNone(self.review.provider_seen_at)

        unread2 = self.api.get("/api/reviews/unread-count/")
        self.assertEqual(unread2.data.get("count"), 0)

    def test_reply_empty_rejected(self):
        res = self.api.post(
            f"/api/reviews/{self.review.id}/reply/",
            {"text": "  ", "publish_reply": True},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)

    def test_other_provider_forbidden(self):
        self.api.force_authenticate(self.other)
        res = self.api.post(
            f"/api/reviews/{self.review.id}/reply/",
            {"text": "Чужой ответ", "publish_reply": True},
            format="json",
        )
        # Not in org queryset → 404; explicit ownership check → 403
        self.assertIn(res.status_code, (403, 404))
