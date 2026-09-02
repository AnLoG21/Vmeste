from decimal import Decimal

from django.test import SimpleTestCase

from vmenu.units import scale_ingredients


class VmenuScaleIngredientsTests(SimpleTestCase):
    def test_doubles_amount_for_double_servings(self):
        ings = [{"name": "Мука", "amount": "200", "unit": "г"}]
        out = scale_ingredients(ings, 4, 8, None)
        self.assertEqual(out[0]["amount"], 400.0)

    def test_clamps_invalid_servings(self):
        ings = [{"name": "Соль", "amount": "1", "unit": "ч.л."}]
        out = scale_ingredients(ings, 0, 0, None)
        self.assertEqual(out[0]["amount"], 1.0)
