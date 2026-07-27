from django.contrib import admin

from . import models

admin.site.register(models.CafeSettings)
admin.site.register(models.CafeFloorPlan)
admin.site.register(models.CafeTable)
admin.site.register(models.CafeMenuCategory)
admin.site.register(models.CafeMenuItem)
admin.site.register(models.CafeMenuItemPhoto)
admin.site.register(models.CafeOrder)
admin.site.register(models.CafeOrderItem)
