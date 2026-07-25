from celery import shared_task

from subscriptions.reminders import send_subscription_expiry_reminders


@shared_task(name="subscriptions.send_expiry_reminders")
def send_expiry_reminders_task():
    return send_subscription_expiry_reminders()
