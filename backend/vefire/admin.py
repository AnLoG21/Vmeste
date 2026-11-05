from django.contrib import admin

from .models import CastRequest


@admin.register(CastRequest)
class CastRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "url", "created_at")
    list_filter = ("status",)
    search_fields = ("url", "user__username", "title")
