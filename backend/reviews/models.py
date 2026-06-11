from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from booking.models import Booking, ProviderStaff


class Review(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_received",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_written",
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviews",
    )
    staff = models.ForeignKey(
        ProviderStaff,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    text = models.TextField(blank=True, default="")
    provider_seen_at = models.DateTimeField(null=True, blank=True)
    supplemented_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ReviewPhoto(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="review_photos/%Y/%m/")


class ReviewLike(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("review", "user")]


class ReviewReply(models.Model):
    review = models.OneToOneField(Review, on_delete=models.CASCADE, related_name="reply")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    sent_via_chat = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
