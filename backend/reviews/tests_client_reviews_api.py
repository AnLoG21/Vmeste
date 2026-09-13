"""API: client create review after done booking; public list by provider."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Service
from users.models import User

from booking.models import AvailabilitySlot, Booking
from reviews.models import Review


@override_settings(FRONTEND_URL="https://vsevmeste.space")
class ClientReviewsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-review-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Review",
        )
        self.client_user = User.objects.create_user(
            username="client-review-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            name="Стрижка",
            duration_minutes=30,
            price=Decimal("1000.00"),
            is_active=True,
        )
        self.api.force_authenticate(self.client_user)

    def _booking(self, *, status=Booking.Status.DONE):
        start = timezone.now() - timedelta(hours=2)
        slot = AvailabilitySlot.objects.create(
            provider=self.provider,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            is_booked=True,
        )
        return Booking.objects.create(
            provider=self.provider,
            client=self.client_user,
            service=self.service,
            slot=slot,
            status=status,
            payment_status="paid",
        )

    def test_create_review_after_done(self):
        booking = self._booking()
        with patch("notifications.push.notify_users"):
            res = self.api.post(
                "/api/reviews/",
                {
                    "provider": self.provider.id,
                    "booking": booking.id,
                    "rating": 5,
                    "text": "Отлично",
                },
                format="json",
            )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("rating"), 5)
        self.assertEqual(Review.objects.filter(booking=booking, client=self.client_user).count(), 1)

    def test_create_rejects_before_done(self):
        booking = self._booking(status=Booking.Status.CONFIRMED)
        res = self.api.post(
            "/api/reviews/",
            {
                "provider": self.provider.id,
                "booking": booking.id,
                "rating": 4,
                "text": "Рано",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertTrue(res.data.get("booking"))
        self.assertEqual(Review.objects.count(), 0)

    def test_provider_cannot_create(self):
        booking = self._booking()
        self.api.force_authenticate(self.provider)
        res = self.api.post(
            "/api/reviews/",
            {
                "provider": self.provider.id,
                "booking": booking.id,
                "rating": 5,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_public_list_by_provider(self):
        booking = self._booking()
        Review.objects.create(
            provider=self.provider,
            client=self.client_user,
            booking=booking,
            rating=5,
            text="Публичный",
        )
        self.api.logout()
        res = self.api.get(f"/api/reviews/?provider={self.provider.id}&ordering=-created_at")
        self.assertEqual(res.status_code, 200, res.data)
        rows = res.data if isinstance(res.data, list) else res.data.get("results") or []
        self.assertGreaterEqual(len(rows), 1)
        self.assertEqual(rows[0].get("rating"), 5)

    def test_supplement_once(self):
        booking = self._booking()
        review = Review.objects.create(
            provider=self.provider,
            client=self.client_user,
            booking=booking,
            rating=4,
            text="Первый",
        )
        res = self.api.patch(
            f"/api/reviews/{review.id}/",
            {"append_text": "Дополнение"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        review.refresh_from_db()
        self.assertIn("Дополнение", review.text)
        self.assertIsNotNone(review.supplemented_at)

        res2 = self.api.patch(
            f"/api/reviews/{review.id}/",
            {"append_text": "Ещё раз"},
            format="json",
        )
        self.assertEqual(res2.status_code, 400, res2.data)
