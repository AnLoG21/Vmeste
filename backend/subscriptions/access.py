from typing import Optional

from django.db.models import Q
from django.utils import timezone

from .models import SubscriptionPlan, UserSubscription


def _is_live(sub: UserSubscription) -> bool:
    if sub.status != UserSubscription.Status.ACTIVE:
        return False
    if sub.period_end and sub.period_end < timezone.now():
        return False
    return True


def provider_can_manage_staff(user) -> bool:
    """Staff seats are a paid feature; bookings stay on the free plan."""
    if not user or not getattr(user, "pk", None):
        return False
    qs = UserSubscription.objects.filter(user=user, status=UserSubscription.Status.ACTIVE).select_related(
        "plan"
    )
    for sub in qs:
        if not _is_live(sub):
            continue
        plan = sub.plan
        if plan.plan_type in (SubscriptionPlan.PlanType.PAID, SubscriptionPlan.PlanType.CUSTOM):
            return True
        if plan.slug in ("business", "enterprise"):
            return True
    return False


def ensure_free_subscription(user) -> Optional[UserSubscription]:
    """Give providers an unlimited free plan so bookings work without a trial."""
    if not user or getattr(user, "role", None) != "provider":
        return None
    live = UserSubscription.objects.filter(user=user, status=UserSubscription.Status.ACTIVE).filter(
        Q(period_end__isnull=True) | Q(period_end__gt=timezone.now())
    )
    if live.exists():
        return live.first()
    plan = SubscriptionPlan.objects.filter(slug="starter", is_active=True).first()
    if not plan:
        return None
    sub = UserSubscription.objects.create(
        user=user,
        plan=plan,
        status=UserSubscription.Status.PENDING,
        source=UserSubscription.Source.TRIAL,
        auto_renew=False,
    )
    now = timezone.now()
    sub.status = UserSubscription.Status.ACTIVE
    sub.period_start = now
    sub.period_end = None
    sub.save(update_fields=["status", "period_start", "period_end", "updated_at"])
    return sub
