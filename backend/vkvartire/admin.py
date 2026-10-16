from django.contrib import admin

from .models import Favorite, Listing, ListingPhoto


class ListingPhotoInline(admin.TabularInline):
    model = ListingPhoto
    extra = 1


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "deal_type",
        "rooms",
        "price",
        "address",
        "metro_name",
        "source",
        "is_active",
        "updated_at",
    )
    list_filter = ("deal_type", "source", "is_active", "is_agent", "rooms")
    search_fields = ("address", "metro_name", "external_id", "fingerprint", "description")
    inlines = [ListingPhotoInline]
    readonly_fields = ("fingerprint", "created_at", "updated_at")


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "listing", "created_at")
    raw_id_fields = ("user", "listing")
