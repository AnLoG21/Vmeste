from django.contrib import admin

from .models import Service, ServiceCategory, ServiceOption, ServiceOptionPhoto, ServicePhoto, ServiceSubcategory

admin.site.register(ServiceCategory)
admin.site.register(ServiceSubcategory)
admin.site.register(Service)
admin.site.register(ServiceOption)
admin.site.register(ServiceOptionPhoto)
admin.site.register(ServicePhoto)
