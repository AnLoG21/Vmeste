from django.contrib import admin

from .models import AvailabilitySlot, Booking, ProviderStaff

admin.site.register(AvailabilitySlot)
admin.site.register(Booking)
admin.site.register(ProviderStaff)
