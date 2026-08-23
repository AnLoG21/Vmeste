from django.core.management.base import BaseCommand

from voice.asterisk_sync import sync_asterisk_configs


class Command(BaseCommand):
    help = "Generate Asterisk PJSIP trunk configs from salon SIP settings."

    def handle(self, *args, **options):
        result = sync_asterisk_configs()
        self.stdout.write(
            self.style.SUCCESS(
                f"Synced {result['trunks']} trunk(s) → {result['pjsip_path']}"
            )
        )
