from django.contrib import admin

from .models import ShopFavorite


@admin.register(ShopFavorite)
class ShopFavoriteAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "provider", "created_at")
    list_select_related = ("user", "provider")
    search_fields = ("user__username", "provider__organization_name", "provider__username")
    raw_id_fields = ("user", "provider")
