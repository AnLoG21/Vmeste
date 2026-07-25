from datetime import timedelta

from django.utils import timezone

from notifications.models import InAppNotification
from notifications.push import notify_users
from users.email_service import send_subscription_reminder_email

from .models import UserSubscription


def _mark_expired():
    now = timezone.now()
    UserSubscription.objects.filter(
        status=UserSubscription.Status.ACTIVE,
        period_end__lt=now,
    ).update(status=UserSubscription.Status.EXPIRED, updated_at=now)


def send_subscription_expiry_reminders() -> dict:
    """Send in-app + email reminders 3 days and 1 day before period_end."""
    _mark_expired()
    now = timezone.now()
    sent_3 = 0
    sent_1 = 0

    window_3_start = now + timedelta(days=2, hours=12)
    window_3_end = now + timedelta(days=3, hours=12)
    qs3 = UserSubscription.objects.filter(
        status=UserSubscription.Status.ACTIVE,
        reminder_3d_sent=False,
        period_end__gte=window_3_start,
        period_end__lt=window_3_end,
    ).select_related("user", "plan")

    for sub in qs3:
        user = sub.user
        plan_name = sub.plan.name if sub.plan_id else "Подписка"
        title = "Подписка истекает через 3 дня"
        body = f"«{plan_name}» действует до {sub.period_end.strftime('%d.%m.%Y')}. Продлите в разделе «Подписки»."
        notify_users(
            [user.id],
            kind=InAppNotification.Kind.SUBSCRIPTION,
            title=title,
            body=body,
            payload={"subscription_id": sub.id, "days_left": 3},
        )
        send_subscription_reminder_email(
            user, days_left=3, period_end=sub.period_end, plan_name=plan_name
        )
        sub.reminder_3d_sent = True
        sub.save(update_fields=["reminder_3d_sent", "updated_at"])
        sent_3 += 1

    window_1_start = now + timedelta(hours=12)
    window_1_end = now + timedelta(days=1, hours=12)
    qs1 = UserSubscription.objects.filter(
        status=UserSubscription.Status.ACTIVE,
        reminder_1d_sent=False,
        period_end__gte=window_1_start,
        period_end__lt=window_1_end,
    ).select_related("user", "plan")

    for sub in qs1:
        user = sub.user
        plan_name = sub.plan.name if sub.plan_id else "Подписка"
        title = "Подписка истекает завтра"
        body = f"«{plan_name}» действует до {sub.period_end.strftime('%d.%m.%Y')}. Продлите сейчас, чтобы не потерять доступ."
        notify_users(
            [user.id],
            kind=InAppNotification.Kind.SUBSCRIPTION,
            title=title,
            body=body,
            payload={"subscription_id": sub.id, "days_left": 1},
        )
        send_subscription_reminder_email(
            user, days_left=1, period_end=sub.period_end, plan_name=plan_name
        )
        sub.reminder_1d_sent = True
        sub.save(update_fields=["reminder_1d_sent", "updated_at"])
        sent_1 += 1

    return {"reminder_3d": sent_3, "reminder_1d": sent_1}
