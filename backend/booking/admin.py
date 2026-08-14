from django.contrib import admin

from .models import AvailabilitySlot, Booking, ProviderAcquiring, ProviderStaff

admin.site.register(AvailabilitySlot)
admin.site.register(Booking)
admin.site.register(ProviderAcquiring)
admin.site.register(ProviderStaff)
