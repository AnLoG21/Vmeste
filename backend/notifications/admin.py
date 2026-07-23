from django.contrib import admin

from .models import DevicePushToken, InAppNotification, SmsLog

admin.site.register(SmsLog)
admin.site.register(InAppNotification)
admin.site.register(DevicePushToken)
