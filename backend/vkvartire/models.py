from __future__ import annotations

import hashlib

from django.conf import settings
from django.db import models


class Listing(models.Model):
    class DealType(models.TextChoices):
        RENT = "rent", "Аренда"
        SALE = "sale", "Продажа"

    class Source(models.TextChoices):
        MANUAL = "manual", "Вручную"
        AVITO = "avito", "Avito"
        CIAN = "cian", "Циан"
        OTHER = "other", "Другое"

    deal_type = models.CharField(max_length=8, choices=DealType.choices, db_index=True)
    rooms = models.PositiveSmallIntegerField(
        default=1,
        help_text="0 = студия, 1–4 = комнаты, 5+ = 5 и более",
        db_index=True,
    )
    price = models.PositiveIntegerField(db_index=True)
    currency = models.CharField(max_length=3, default="RUB")
    area_m2 = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    floor = models.PositiveSmallIntegerField(null=True, blank=True)
    floors_total = models.PositiveSmallIntegerField(null=True, blank=True)
    address = models.CharField(max_length=512, blank=True, default="")
    lat = models.FloatField(null=True, blank=True, db_index=True)
    lon = models.FloatField(null=True, blank=True, db_index=True)
    metro_name = models.CharField(max_length=128, blank=True, default="")
    metro_walk_min = models.PositiveSmallIntegerField(null=True, blank=True)
    description = models.TextField(blank=True, default="")
    source = models.CharField(
        max_length=16, choices=Source.choices, default=Source.MANUAL, db_index=True
    )
    external_id = models.CharField(max_length=128, blank=True, default="")
    external_url = models.URLField(max_length=1024, blank=True, default="")
    fingerprint = models.CharField(max_length=64, blank=True, default="", db_index=True)
    is_agent = models.BooleanField(default=False, help_text="Объявление от посредника")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["source", "external_id"],
                condition=~models.Q(external_id=""),
                name="uniq_vkvartire_source_external_id",
            ),
        ]
        indexes = [
            models.Index(fields=["deal_type", "price", "rooms"]),
            models.Index(fields=["is_active", "deal_type"]),
        ]

    def __str__(self) -> str:
        return f"Listing({self.deal_type}, {self.rooms}к, {self.price})"

    @staticmethod
    def make_fingerprint(
        *,
        address: str,
        rooms: int,
        area_m2,
        price: int,
        deal_type: str,
    ) -> str:
        area = ""
        if area_m2 is not None:
            try:
                area = f"{float(area_m2):.1f}"
            except (TypeError, ValueError):
                area = str(area_m2)
        # Price bucket ±2% so near-duplicates collide
        bucket = int(round(price / 1000) * 1000) if price else 0
        raw = "|".join(
            [
                (address or "").strip().lower(),
                str(int(rooms or 0)),
                area,
                str(bucket),
                (deal_type or "").strip().lower(),
            ]
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def refresh_fingerprint(self, save: bool = False) -> str:
        self.fingerprint = self.make_fingerprint(
            address=self.address,
            rooms=self.rooms,
            area_m2=self.area_m2,
            price=self.price,
            deal_type=self.deal_type,
        )
        if save:
            self.save(update_fields=["fingerprint", "updated_at"])
        return self.fingerprint

    def save(self, *args, **kwargs):
        if not self.fingerprint:
            self.refresh_fingerprint(save=False)
        super().save(*args, **kwargs)


class ListingPhoto(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="vkvartire/photos/", blank=True, null=True)
    url = models.URLField(max_length=1024, blank=True, default="")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return f"ListingPhoto(listing={self.listing_id}, order={self.sort_order})"

    @property
    def display_url(self) -> str:
        if self.url:
            return self.url
        if self.image:
            try:
                return self.image.url
            except ValueError:
                return ""
        return ""


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vkvartire_favorites",
    )
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="favorites")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "listing"], name="uniq_vkvartire_favorite"),
        ]
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"Favorite(user={self.user_id}, listing={self.listing_id})"
