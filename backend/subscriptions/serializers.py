from rest_framework import serializers

from .models import Payment, SubscriptionPlan, UserSubscription


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ["id", "slug", "name", "description", "price_monthly", "features"]


class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    is_active_now = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            "id",
            "plan",
            "status",
            "period_start",
            "period_end",
            "auto_renew",
            "cancel_at_period_end",
            "is_active_now",
            "created_at",
        ]


class PaymentSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="plan.name", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "plan_name",
            "amount",
            "status",
            "confirmation_url",
            "created_at",
            "paid_at",
        ]
