"""Guest menu exposes nutrition fields from CafeMenuItemSerializer."""

from django.test import SimpleTestCase

from cafe.serializers import CafeMenuItemSerializer


class CafeMenuNutritionSerializerTests(SimpleTestCase):
    def test_serializer_includes_weight_and_calories(self):
        fields = set(CafeMenuItemSerializer.Meta.fields)
        self.assertIn("weight_grams", fields)
        self.assertIn("calories", fields)
        self.assertIn("composition", fields)
