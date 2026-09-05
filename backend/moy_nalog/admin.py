from django.contrib import admin

from .models import MoyNalogAccount, NpdReceipt


@admin.register(MoyNalogAccount)
class MoyNalogAccountAdmin(admin.ModelAdmin):
    list_display = ("id", "provider", "inn", "display_name", "enabled", "connected_at", "updated_at")
    search_fields = ("inn", "display_name", "provider__email", "provider__organization_name")
    list_filter = ("enabled",)
    readonly_fields = ("access_token_enc", "refresh_token_enc", "device_id", "created_at", "updated_at")


@admin.register(NpdReceipt)
class NpdReceiptAdmin(admin.ModelAdmin):
    list_display = ("id", "provider", "source", "source_id", "amount", "status", "receipt_uuid", "created_at")
    list_filter = ("status", "source")
    search_fields = ("receipt_uuid", "service_name", "provider__organization_name")
    readonly_fields = ("created_at", "updated_at", "attempted_at", "issued_at")
