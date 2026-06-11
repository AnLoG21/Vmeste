from celery import shared_task


@shared_task
def noop_notification_task():
    return None
