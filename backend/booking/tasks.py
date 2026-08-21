from celery import shared_task


@shared_task(name="booking.send_booking_reminders")
def send_booking_reminders_task():
    from booking.reminders import send_booking_reminders

    return send_booking_reminders()


@shared_task(name="booking.send_winback_reminders")
def send_winback_reminders_task():
    from booking.reminders import send_winback_reminders

    return send_winback_reminders()
