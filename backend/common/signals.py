from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from booking.models import ProviderStaff, StaffPortfolioPhoto
from cafe.models import CafeMenuItemPhoto, CafeSettings
from catalog.models import ServicePhoto
from chat.models import Conversation, Message
from inspections.models import InspectionItemMedia
from reviews.models import ReviewPhoto
from users.models import ProviderGalleryPhoto

from .image_processing import is_image_name, process_image_file


def _process_field(instance, field_name: str) -> None:
    file_field = getattr(instance, field_name, None)
    if not file_field or not file_field.name or not is_image_name(file_field.name):
        return
    process_image_file(file_field.name)


@receiver(post_save, sender=ProviderGalleryPhoto)
def _gallery_photo_saved(sender, instance, **kwargs):
    _process_field(instance, "image")


@receiver(post_save, sender=ReviewPhoto)
def _review_photo_saved(sender, instance, **kwargs):
    _process_field(instance, "image")


@receiver(post_save, sender=ServicePhoto)
def _service_photo_saved(sender, instance, **kwargs):
    _process_field(instance, "image")


@receiver(post_save, sender=StaffPortfolioPhoto)
def _portfolio_photo_saved(sender, instance, **kwargs):
    _process_field(instance, "image")


@receiver(post_save, sender=ProviderStaff)
def _staff_avatar_saved(sender, instance, **kwargs):
    _process_field(instance, "avatar_image")


@receiver(post_save, sender=CafeSettings)
def _cafe_logo_saved(sender, instance, **kwargs):
    _process_field(instance, "logo")


@receiver(post_save, sender=CafeMenuItemPhoto)
def _cafe_menu_photo_saved(sender, instance, **kwargs):
    _process_field(instance, "image")


@receiver(post_save, sender=InspectionItemMedia)
def _inspection_photo_saved(sender, instance, **kwargs):
    _process_field(instance, "image")


@receiver(post_save, sender=Message)
def _chat_attachment_saved(sender, instance, **kwargs):
    _process_field(instance, "attachment")
