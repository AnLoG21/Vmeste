from django.conf import settings
from django.db import models


class ServiceCategory(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="service_categories"
    )
    name = models.CharField(max_length=120)
    allow_subcategory_booking = models.BooleanField(default=True)
    template_slug = models.CharField(max_length=80, blank=True, default="", db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "template_slug"],
                condition=models.Q(template_slug__gt=""),
                name="uniq_provider_category_template_slug",
            ),
        ]


class ServiceSubcategory(models.Model):
    category = models.ForeignKey(
        ServiceCategory, on_delete=models.CASCADE, related_name="subcategories"
    )
    name = models.CharField(max_length=120)
    template_slug = models.CharField(max_length=80, blank=True, default="", db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["category", "template_slug"],
                condition=models.Q(template_slug__gt=""),
                name="uniq_category_subcategory_template_slug",
            ),
        ]


class Service(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="services"
    )
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="services",
    )
    subcategory = models.ForeignKey(
        ServiceSubcategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="services",
    )
    name = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_minutes = models.PositiveIntegerField(default=30)
    is_active = models.BooleanField(default=True)
    template_slug = models.CharField(max_length=80, blank=True, default="", db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "template_slug"],
                condition=models.Q(template_slug__gt=""),
                name="uniq_provider_service_template_slug",
            ),
        ]
