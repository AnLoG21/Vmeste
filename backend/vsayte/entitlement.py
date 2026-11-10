"""Всайте plan gates: free / hosting / pro."""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone

from subscriptions.models import SubscriptionPlan, UserSubscription

FREE_SLUG = "vsayte-free"
HOSTING_SLUG = "vsayte-hosting"
PRO_SLUG = "vsayte-pro"

LIMITS = {
    FREE_SLUG: {
        "max_sites": 1,
        "max_pages": 2,
        "max_assets": 5,
        "max_asset_bytes": 1_000_000,
        "can_publish": False,
        "can_custom_domain": False,
        "editor_tier": "basic",
    },
    HOSTING_SLUG: {
        "max_sites": 3,
        "max_pages": 5,
        "max_assets": 20,
        "max_asset_bytes": 3_000_000,
        "can_publish": True,
        "can_custom_domain": False,
        "editor_tier": "basic",
    },
    PRO_SLUG: {
        "max_sites": 50,
        "max_pages": 100,
        "max_assets": 500,
        "max_asset_bytes": 20_000_000,
        "can_publish": True,
        "can_custom_domain": True,
        "editor_tier": "pro",
    },
}


def is_vsayte_plan(plan: SubscriptionPlan | None) -> bool:
    if not plan:
        return False
    return plan.product_kind == SubscriptionPlan.ProductKind.VSAYTE


def live_vsayte_subscription(user) -> UserSubscription | None:
    if not user or not getattr(user, "pk", None):
        return None
    now = timezone.now()
    return (
        UserSubscription.objects.filter(
            user=user,
            status=UserSubscription.Status.ACTIVE,
            plan__product_kind=SubscriptionPlan.ProductKind.VSAYTE,
        )
        .filter(Q(period_end__isnull=True) | Q(period_end__gt=now))
        .select_related("plan")
        .order_by("-period_start", "-id")
        .first()
    )


def ensure_free_vsayte_subscription(user) -> UserSubscription | None:
    """Grant free vsayte plan if user has no live vsayte subscription."""
    live = live_vsayte_subscription(user)
    if live:
        return live
    plan = SubscriptionPlan.objects.filter(slug=FREE_SLUG, is_active=True).first()
    if not plan:
        return None
    now = timezone.now()
    # Cancel nothing — free is the baseline; paid vsayte plans replace via pay flow.
    sub = UserSubscription.objects.create(
        user=user,
        plan=plan,
        status=UserSubscription.Status.ACTIVE,
        source=UserSubscription.Source.TRIAL,
        auto_renew=False,
        period_start=now,
        period_end=None,
    )
    return sub


def current_limits(user) -> dict:
    from .access import user_has_full_vsayte_access

    if user_has_full_vsayte_access(user):
        base = dict(LIMITS[PRO_SLUG])
        base["plan_slug"] = PRO_SLUG
        base["plan_name"] = "Всайте — Pro (полный доступ)"
        base["full_access"] = True
        return base

    live = live_vsayte_subscription(user)
    slug = live.plan.slug if live and live.plan_id else FREE_SLUG
    base = dict(LIMITS.get(slug) or LIMITS[FREE_SLUG])
    base["plan_slug"] = slug
    base["plan_name"] = live.plan.name if live and live.plan_id else "Бесплатный"
    base["full_access"] = False
    return base


def can_publish(user) -> bool:
    return bool(current_limits(user).get("can_publish"))


def can_custom_domain(user) -> bool:
    return bool(current_limits(user).get("can_custom_domain"))


def editor_tier(user) -> str:
    return current_limits(user).get("editor_tier") or "basic"
