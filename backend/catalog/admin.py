from django.contrib import admin

from .models import Service, ServiceCategory, ServiceSubcategory

admin.site.register(ServiceCategory)
admin.site.register(ServiceSubcategory)
admin.site.register(Service)
