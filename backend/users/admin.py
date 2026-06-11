from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Vmeste",
            {
                "fields": (
                    "role",
                    "phone",
                    "patronymic",
                    "email_verified",
                    "organization_name",
                    "organization_address",
                    "organization_latitude",
                    "organization_longitude",
                    "provider_sphere",
                )
            },
        ),
    )
    list_display = ("username", "email", "role", "is_staff", "is_active")
