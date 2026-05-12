from django.conf import settings
from django.db import models


class ProviderLocation(models.Model):
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="locations"
    )
    title = models.CharField(max_length=150)
    address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    entrance = models.CharField(max_length=32, blank=True, default="")
    floor = models.CharField(max_length=32, blank=True, default="")
    apartment = models.CharField(max_length=64, blank=True, default="")
    intercom = models.CharField(max_length=64, blank=True, default="")
    address_details = models.CharField(max_length=255, blank=True, default="")
