from django.contrib import admin

from .models import InAppNotification, SmsLog

admin.site.register(SmsLog)
admin.site.register(InAppNotification)
