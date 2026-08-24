"""Apply / revoke SpeechKit minute quota from voice subscription plans."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from .models import SubscriptionPlan, UserSubscription

# Fallback when no paid voice plan is active (demo / free allowance).
FREE_VOICE_MINUTES = Decimal("30")


def is_voice_plan(plan: SubscriptionPlan | None) -> bool:
    if not plan:
        return False
    return plan.product_kind == SubscriptionPlan.ProductKind.VOICE


def live_voice_subscription(user) -> UserSubscription | None:
    if not user or not getattr(user, "pk", None):
        return None
    now = timezone.now()
    qs = (
        UserSubscription.objects.filter(
            user=user,
            status=UserSubscription.Status.ACTIVE,
            plan__product_kind=SubscriptionPlan.ProductKind.VOICE,
        )
        .filter(Q(period_end__isnull=True) | Q(period_end__gt=now))
        .select_related("plan")
        .order_by("-period_start", "-id")
    )
    return qs.first()


def cancel_other_active_same_kind(user, plan: SubscriptionPlan, *, except_id: int | None = None) -> int:
    """End other live subscriptions of the same product_kind (change plan)."""
    qs = UserSubscription.objects.filter(
        user=user,
        status=UserSubscription.Status.ACTIVE,
        plan__product_kind=plan.product_kind,
    )
    if except_id:
        qs = qs.exclude(pk=except_id)
    return qs.update(
        status=UserSubscription.Status.CANCELLED,
        auto_renew=False,
        cancel_at_period_end=False,
        updated_at=timezone.now(),
    )


def apply_voice_quota_from_plan(user, plan: SubscriptionPlan, *, period_start=None) -> None:
    """Reset period and used minutes to the new voice tariff (buy / renew / change)."""
    if not is_voice_plan(plan):
        return
    from voice.models import ProviderVoiceSettings

    minutes = int(plan.voice_minutes_monthly or 0)
    if minutes <= 0:
        return
    vs, _ = ProviderVoiceSettings.objects.get_or_create(provider=user)
    vs.voice_minutes_quota = Decimal(str(minutes))
    vs.voice_minutes_used = Decimal("0")
    vs.voice_minutes_period_start = period_start or timezone.now()
    vs.save(
        update_fields=[
            "voice_minutes_quota",
            "voice_minutes_used",
            "voice_minutes_period_start",
        ]
    )


def sync_voice_quota_for_user(user) -> None:
    """After voice plan ends: keep another live voice plan, else free allowance."""
    from voice.models import ProviderVoiceSettings

    live = live_voice_subscription(user)
    if live and live.plan_id and int(live.plan.voice_minutes_monthly or 0) > 0:
        vs, _ = ProviderVoiceSettings.objects.get_or_create(provider=user)
        vs.voice_minutes_quota = Decimal(str(int(live.plan.voice_minutes_monthly)))
        if not vs.voice_minutes_period_start:
            vs.voice_minutes_period_start = live.period_start or timezone.now()
        vs.save(update_fields=["voice_minutes_quota", "voice_minutes_period_start"])
        return

    vs = ProviderVoiceSettings.objects.filter(provider=user).first()
    if not vs:
        return
    vs.voice_minutes_quota = FREE_VOICE_MINUTES
    vs.voice_minutes_used = Decimal("0")
    vs.voice_minutes_period_start = timezone.now()
    vs.save(
        update_fields=[
            "voice_minutes_quota",
            "voice_minutes_used",
            "voice_minutes_period_start",
        ]
    )


def on_subscription_activated(subscription: UserSubscription) -> None:
    plan = subscription.plan
    cancel_other_active_same_kind(subscription.user, plan, except_id=subscription.id)
    if is_voice_plan(plan):
        apply_voice_quota_from_plan(
            subscription.user,
            plan,
            period_start=subscription.period_start,
        )


def on_voice_subscription_ended(user) -> None:
    sync_voice_quota_for_user(user)
