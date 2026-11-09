from django.contrib import admin

from .models import Site, SiteAsset, SiteDomain, SitePublish


class SiteDomainInline(admin.TabularInline):
    model = SiteDomain
    extra = 0


class SitePublishInline(admin.TabularInline):
    model = SitePublish
    extra = 0
    readonly_fields = ("version", "storage_path", "checksum", "created_at")


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "owner", "status", "published_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("title", "slug", "owner__email")
    inlines = [SiteDomainInline, SitePublishInline]


@admin.register(SiteAsset)
class SiteAssetAdmin(admin.ModelAdmin):
    list_display = ("id", "site", "original_name", "size_bytes", "created_at")
    search_fields = ("original_name", "site__slug")


@admin.register(SiteDomain)
class SiteDomainAdmin(admin.ModelAdmin):
    list_display = ("hostname", "kind", "status", "site", "updated_at")
    list_filter = ("kind", "status")
    search_fields = ("hostname",)
