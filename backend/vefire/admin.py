from django.contrib import admin

from .models import AgentHeartbeat, CastRequest


@admin.register(CastRequest)
class CastRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "url", "created_at")
    list_filter = ("status",)
    search_fields = ("url", "user__username", "title")


@admin.register(AgentHeartbeat)
class AgentHeartbeatAdmin(admin.ModelAdmin):
    list_display = ("user", "remote_url", "updated_at")
    search_fields = ("user__username", "remote_url")
