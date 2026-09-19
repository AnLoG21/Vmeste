"""Unit: common.image_processing helpers."""

import tempfile
from pathlib import Path

from django.test import SimpleTestCase, override_settings
from PIL import Image

from common.image_processing import is_image_name, process_image_file, thumb_storage_name


class ImageProcessingTests(SimpleTestCase):
    def test_is_image_name(self):
        self.assertTrue(is_image_name("photo.JPG"))
        self.assertTrue(is_image_name("a.webp"))
        self.assertFalse(is_image_name("notes.txt"))
        self.assertFalse(is_image_name(""))

    def test_thumb_storage_name(self):
        self.assertEqual(thumb_storage_name("gallery/a.png"), "gallery/a.thumb.webp")

    def test_process_image_file_writes_thumb(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                rel = "uploads/unit.png"
                full = Path(tmp) / rel
                full.parent.mkdir(parents=True, exist_ok=True)
                Image.new("RGB", (80, 60), color=(20, 40, 60)).save(full, "PNG")

                thumb = process_image_file(rel)
                self.assertEqual(thumb, "uploads/unit.thumb.webp")
                self.assertTrue((Path(tmp) / thumb).is_file())
