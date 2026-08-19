from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage

from .image_processing import is_image_name, thumb_storage_name


def absolute_media_url(request, relative_url: str) -> str:
    rel = (relative_url or "").strip()
    if not rel:
        return ""
    if rel.startswith("http://") or rel.startswith("https://"):
        return rel
    origin = (getattr(settings, "FRONTEND_URL", "") or "").strip().rstrip("/")
    if origin.startswith("http"):
        return f"{origin}{rel if rel.startswith('/') else f'/{rel}'}"
    if request is not None:
        return request.build_absolute_uri(rel)
    return rel


def _existing_thumb_name(storage_name: str) -> str:
    thumb_name = thumb_storage_name(storage_name)
    thumb_path = Path(settings.MEDIA_ROOT) / thumb_name
    if thumb_path.is_file():
        return thumb_name.replace("\\", "/")
    return ""


def photo_urls(request, file_field, *, relative: bool = False) -> dict[str, str]:
    """Full and thumbnail URLs for an uploaded image field."""
    if not file_field or not getattr(file_field, "name", None):
        return {"url": "", "thumb_url": ""}

    storage_name = file_field.name
    rel = file_field.url
    if relative:
        url = rel
    else:
        url = absolute_media_url(request, rel)

    if not is_image_name(storage_name):
        return {"url": url, "thumb_url": url}

    thumb_name = _existing_thumb_name(storage_name)
    if thumb_name:
        thumb_rel = default_storage.url(thumb_name)
        thumb_url = thumb_rel if relative else absolute_media_url(request, thumb_rel)
    else:
        thumb_url = url

    return {"url": url, "thumb_url": thumb_url}
