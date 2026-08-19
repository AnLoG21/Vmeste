from __future__ import annotations

import os
from pathlib import Path

from django.conf import settings
from PIL import Image, ImageOps

THUMB_MAX = 480
ORIGINAL_MAX = 1920
WEBP_QUALITY = 82
JPEG_QUALITY = 85

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic", ".heif"}


def is_image_name(name: str) -> bool:
    if not name:
        return False
    return os.path.splitext(str(name).lower())[1] in _IMAGE_EXTENSIONS


def thumb_storage_name(name: str) -> str:
    base, _ = os.path.splitext(name)
    return f"{base}.thumb.webp"


def _open_image(path: Path) -> Image.Image | None:
    try:
        img = Image.open(path)
        img = ImageOps.exif_transpose(img)
    except Exception:
        return None
    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        return background
    if img.mode != "RGB":
        return img.convert("RGB")
    return img


def _resize(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_side:
        return img
    if w >= h:
        nw = max_side
        nh = max(1, int(h * max_side / w))
    else:
        nh = max_side
        nw = max(1, int(w * max_side / h))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def _save_original(img: Image.Image, path: Path) -> None:
    ext = path.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        img.save(path, "JPEG", quality=JPEG_QUALITY, optimize=True)
    elif ext == ".png":
        img.save(path, "PNG", optimize=True)
    elif ext == ".webp":
        img.save(path, "WEBP", quality=WEBP_QUALITY, method=4)
    elif ext == ".gif":
        img.save(path, "GIF", optimize=True)
    else:
        img.save(path, "JPEG", quality=JPEG_QUALITY, optimize=True)


def process_image_file(storage_name: str) -> str | None:
    """Resize the original in place and write a WebP thumbnail. Returns thumb storage path."""
    if not storage_name or not is_image_name(storage_name):
        return None

    full = Path(settings.MEDIA_ROOT) / storage_name
    if not full.is_file():
        return None

    img = _open_image(full)
    if img is None:
        return None

    resized = _resize(img, ORIGINAL_MAX)
    _save_original(resized, full)

    thumb_name = thumb_storage_name(storage_name)
    thumb_path = Path(settings.MEDIA_ROOT) / thumb_name
    thumb_path.parent.mkdir(parents=True, exist_ok=True)
    thumb = _resize(resized, THUMB_MAX)
    thumb.save(thumb_path, "WEBP", quality=WEBP_QUALITY, method=4)
    return thumb_name.replace("\\", "/")


def ensure_thumbnail(storage_name: str) -> str:
    thumb_name = thumb_storage_name(storage_name)
    thumb_path = Path(settings.MEDIA_ROOT) / thumb_name
    if thumb_path.is_file():
        return thumb_name.replace("\\", "/")
    generated = process_image_file(storage_name)
    return generated or ""
