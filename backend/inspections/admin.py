from django.contrib import admin

from .models import InspectionItem, InspectionItemMedia, InspectionReport

admin.site.register(InspectionReport)
admin.site.register(InspectionItem)
admin.site.register(InspectionItemMedia)
