from django.contrib import admin

from .models import Brand, CarModel, Guide, GuideFile, GuideStep


class GuideStepInline(admin.TabularInline):
    model = GuideStep
    extra = 0
    ordering = ("order",)


class GuideFileInline(admin.TabularInline):
    model = GuideFile
    extra = 0


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sort_order", "updated_at")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(CarModel)
class CarModelAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "years", "head_unit", "sort_order")
    list_filter = ("brand",)
    search_fields = ("name", "head_unit")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Guide)
class GuideAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "car_model",
        "category",
        "risk_level",
        "verified",
        "status",
        "sort_order",
        "updated_at",
    )
    list_filter = ("status", "category", "risk_level", "verified", "car_model__brand")
    search_fields = ("title", "summary", "brick_warning")
    inlines = [GuideStepInline, GuideFileInline]


@admin.register(GuideStep)
class GuideStepAdmin(admin.ModelAdmin):
    list_display = ("order", "title", "guide")
    list_filter = ("guide__car_model__brand",)


@admin.register(GuideFile)
class GuideFileAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "role",
        "is_required",
        "original_name",
        "guide",
        "step",
        "size_bytes",
        "created_at",
    )
    list_filter = ("role", "is_required")
