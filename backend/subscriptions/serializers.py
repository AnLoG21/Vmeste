from rest_framework import serializers

from .models import Payment, SubscriptionPlan, UserSubscription


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "price_monthly",
            "features",
            "plan_type",
            "product_kind",
            "voice_minutes_monthly",
            "trial_days",
        ]


class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    is_active_now = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            "id",
            "plan",
            "status",
            "source",
            "promo_code",
            "period_start",
            "period_end",
            "auto_renew",
            "cancel_at_period_end",
            "is_active_now",
            "refunded_at",
            "created_at",
        ]


class PaymentSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "plan_name",
            "amount",
            "status",
            "status_label",
            "confirmation_url",
            "created_at",
            "paid_at",
            "refunded_at",
        ]

    def get_status_label(self, obj):
        return obj.get_status_display()
