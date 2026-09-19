"""Unit: common.media_urls.photo_urls."""

from types import SimpleNamespace

from django.test import SimpleTestCase, override_settings

from common.media_urls import absolute_media_url, photo_urls


class MediaUrlsTests(SimpleTestCase):
    def test_photo_urls_empty(self):
        self.assertEqual(photo_urls(None, None), {"url": "", "thumb_url": ""})
        self.assertEqual(photo_urls(None, SimpleNamespace(name="")), {"url": "", "thumb_url": ""})

    @override_settings(FRONTEND_URL="https://vsevmeste.space")
    def test_photo_urls_absolute(self):
        field = SimpleNamespace(name="a.jpg", url="/media/a.jpg")
        out = photo_urls(None, field)
        self.assertEqual(out["url"], "https://vsevmeste.space/media/a.jpg")
        self.assertEqual(out["thumb_url"], out["url"])

    def test_photo_urls_relative(self):
        field = SimpleNamespace(name="a.jpg", url="/media/a.jpg")
        out = photo_urls(None, field, relative=True)
        self.assertEqual(out["url"], "/media/a.jpg")

    @override_settings(FRONTEND_URL="")
    def test_absolute_media_url_passthrough(self):
        self.assertEqual(absolute_media_url(None, "https://cdn.example/x.png"), "https://cdn.example/x.png")
        self.assertEqual(absolute_media_url(None, "/media/x.png"), "/media/x.png")
