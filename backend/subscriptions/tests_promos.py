from django.test import SimpleTestCase

from subscriptions.promos import PROMO_CODES, normalize_promo_code


class PromoCodeTests(SimpleTestCase):
    def test_normalize_trims_and_uppercases(self):
        self.assertEqual(normalize_promo_code("  vsevmeste  "), "VSEVMESTE")

    def test_known_code_has_plan(self):
        self.assertIn("VSEVMESTE", PROMO_CODES)
        self.assertEqual(PROMO_CODES["VSEVMESTE"]["plan_slug"], "business")
