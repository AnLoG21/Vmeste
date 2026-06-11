from django.contrib import admin

from .models import Payment, SubscriptionPlan, UserSubscription


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "price_monthly", "is_active", "sort_order"]


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "plan", "status", "period_end", "auto_renew"]
    list_filter = ["status"]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "plan", "amount", "status", "created_at"]
    list_filter = ["status"]
