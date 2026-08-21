"""Working hours open/closed checks for org profile and cafe orders."""

from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from users.org_profile import (
    default_working_hours,
    is_organization_open_now,
    organization_closed_order_detail,
)


MSK = ZoneInfo("Europe/Moscow")


class OrganizationOpenNowTests(SimpleTestCase):
    def test_open_during_hours(self):
        hours = default_working_hours()
        when = datetime(2026, 8, 21, 12, 0, tzinfo=MSK)  # Friday
        self.assertTrue(is_organization_open_now(hours, when))

    def test_closed_before_open(self):
        hours = default_working_hours()
        when = datetime(2026, 8, 21, 8, 0, tzinfo=MSK)
        self.assertFalse(is_organization_open_now(hours, when))

    def test_closed_after_close(self):
        hours = default_working_hours()
        when = datetime(2026, 8, 21, 18, 0, tzinfo=MSK)
        self.assertFalse(is_organization_open_now(hours, when))

    def test_day_off(self):
        hours = default_working_hours()
        hours["fri"] = {"open": "09:00", "close": "18:00", "closed": True}
        when = datetime(2026, 8, 21, 12, 0, tzinfo=MSK)
        self.assertFalse(is_organization_open_now(hours, when))
        self.assertIn("выходной", organization_closed_order_detail(hours, when).lower())

    def test_overnight_hours(self):
        hours = default_working_hours()
        hours["fri"] = {"open": "22:00", "close": "02:00", "closed": False}
        late = datetime(2026, 8, 21, 23, 30, tzinfo=MSK)
        early = datetime(2026, 8, 22, 1, 0, tzinfo=MSK)  # суббота 01:00 — ещё пятничный ночной слот
        self.assertTrue(is_organization_open_now(hours, late))
        self.assertTrue(is_organization_open_now(hours, early))
        too_late = datetime(2026, 8, 22, 3, 0, tzinfo=MSK)
        self.assertFalse(is_organization_open_now(hours, too_late))
