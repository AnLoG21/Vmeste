from django.contrib import admin

from . import models

admin.site.register(models.MarketplaceSettings)
admin.site.register(models.MarketplaceProductHistory)
admin.site.register(models.MarketplaceTemplate)
admin.site.register(models.MarketplaceReplyTemplate)
admin.site.register(models.MarketplaceApiLog)
