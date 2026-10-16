from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Listing


@receiver(post_save, sender=Listing)
def listing_created_notify(sender, instance: Listing, created: bool, **kwargs):
    if not created or not instance.is_active:
        return
    try:
        from .notify import notify_saved_searches_for_listing

        notify_saved_searches_for_listing(instance)
    except Exception:
        pass
