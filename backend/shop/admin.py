from django.contrib import admin

from . import models

admin.site.register(models.ProductCategory)
admin.site.register(models.ProductSubcategory)
admin.site.register(models.Product)
admin.site.register(models.ProductPhoto)
admin.site.register(models.StockMovement)
admin.site.register(models.ServiceMaterial)
admin.site.register(models.ShopSettings)
admin.site.register(models.ShopOrder)
admin.site.register(models.ShopOrderItem)
