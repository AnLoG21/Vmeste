from django.conf import settings
from django.db import models


class ShopFavorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shop_favorites",
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorited_by_clients",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "provider"], name="uniq_vmagazine_shop_favorite"),
        ]
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"ShopFavorite(user={self.user_id}, provider={self.provider_id})"
