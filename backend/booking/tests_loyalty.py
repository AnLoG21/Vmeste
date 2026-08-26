"""Loyalty helpers without heavy fixtures."""

from django.test import SimpleTestCase

from booking.loyalty import loyalty_level


class LoyaltyLevelTests(SimpleTestCase):
    def test_tiers(self):
        self.assertEqual(loyalty_level(0)["level"], "start")
        self.assertEqual(loyalty_level(49)["level_label"], "Старт")
        self.assertEqual(loyalty_level(50)["level"], "silver")
        self.assertEqual(loyalty_level(200)["level"], "gold")
        self.assertEqual(loyalty_level(500)["level"], "platinum")
        self.assertEqual(loyalty_level(999)["level_label"], "Платина")
