from django.core.management.base import BaseCommand

from subscriptions.reminders import send_subscription_expiry_reminders


class Command(BaseCommand):
    help = "Send subscription expiry reminders (3 days and 1 day) + mark expired."

    def handle(self, *args, **options):
        result = send_subscription_expiry_reminders()
        self.stdout.write(
            self.style.SUCCESS(
                f"Reminders sent: 3d={result['reminder_3d']}, 1d={result['reminder_1d']}"
            )
        )
