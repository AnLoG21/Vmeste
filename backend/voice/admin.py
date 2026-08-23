from django.contrib import admin

from .models import ProviderVoiceSettings, VoiceCallSession, VoiceCallTurn


@admin.register(ProviderVoiceSettings)
class ProviderVoiceSettingsAdmin(admin.ModelAdmin):
    list_display = ("provider", "enabled", "inbound_phone", "ats_provider", "updated_at")
    search_fields = ("provider__organization_name", "provider__username", "webhook_token")


class VoiceCallTurnInline(admin.TabularInline):
    model = VoiceCallTurn
    extra = 0
    readonly_fields = ("role", "text", "tool_name", "created_at")


@admin.register(VoiceCallSession)
class VoiceCallSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "provider", "caller_phone", "status", "booking_id", "started_at")
    list_filter = ("status",)
    inlines = [VoiceCallTurnInline]
