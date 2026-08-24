from django.contrib import admin

from .models import Payment, PromoRedemption, SubscriptionPlan, UserSubscription


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "slug",
        "product_kind",
        "plan_type",
        "price_monthly",
        "voice_minutes_monthly",
        "trial_days",
        "is_active",
        "sort_order",
    ]
    list_filter = ["product_kind", "plan_type", "is_active"]


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "plan", "status", "source", "period_end", "auto_renew", "promo_code"]
    list_filter = ["status", "source"]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "plan", "amount", "status", "created_at", "refunded_at"]
    list_filter = ["status"]


@admin.register(PromoRedemption)
class PromoRedemptionAdmin(admin.ModelAdmin):
    list_display = ["user", "code", "created_at", "subscription"]
    list_filter = ["code"]
