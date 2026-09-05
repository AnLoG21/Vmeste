"""Delivery zone point-in-polygon + quote helpers."""

from decimal import Decimal

from django.test import SimpleTestCase

from cafe.delivery_zones import (
    find_delivery_zone,
    normalize_delivery_zones,
    point_in_polygon,
    quote_delivery_for_point,
)


SQUARE = [[55.0, 37.0], [55.0, 38.0], [56.0, 38.0], [56.0, 37.0]]


class DeliveryZonesTests(SimpleTestCase):
    def test_point_inside_square(self):
        self.assertTrue(point_in_polygon(55.5, 37.5, SQUARE))
        self.assertFalse(point_in_polygon(54.5, 37.5, SQUARE))

    def test_find_zone(self):
        zones = normalize_delivery_zones(
            [
                {
                    "name": "Центр",
                    "fee": "200",
                    "min_order": "500",
                    "polygon": SQUARE,
                }
            ]
        )
        z = find_delivery_zone(55.5, 37.5, zones)
        self.assertIsNotNone(z)
        self.assertEqual(z["name"], "Центр")
        self.assertEqual(z["fee"], "200.00")
        self.assertIsNone(find_delivery_zone(50.0, 30.0, zones))

    def test_quote_inside_zone_applies_fee(self):
        zones = [{"name": "Центр", "fee": "150", "min_order": "400", "polygon": SQUARE}]
        fee, zone, err = quote_delivery_for_point(
            zones=zones,
            fallback_fee="99",
            fallback_min_order="0",
            lat=55.5,
            lon=37.5,
            items_total="500",
        )
        self.assertIsNone(err)
        self.assertEqual(fee, Decimal("150.00"))
        self.assertEqual(zone["name"], "Центр")

    def test_quote_outside_zone_rejected(self):
        zones = [{"name": "Центр", "fee": "150", "min_order": "0", "polygon": SQUARE}]
        fee, zone, err = quote_delivery_for_point(
            zones=zones,
            fallback_fee="99",
            fallback_min_order="0",
            lat=50.0,
            lon=30.0,
            items_total="500",
        )
        self.assertIsNone(fee)
        self.assertIsNone(zone)
        self.assertIn("вне зон", err)

    def test_quote_missing_point_when_zones_exist(self):
        zones = [{"name": "Центр", "fee": "150", "min_order": "0", "polygon": SQUARE}]
        fee, zone, err = quote_delivery_for_point(
            zones=zones,
            fallback_fee="99",
            fallback_min_order="0",
            lat=None,
            lon=None,
            items_total="500",
        )
        self.assertIsNone(fee)
        self.assertIn("карте", err.lower())

    def test_quote_min_order_for_zone(self):
        zones = [{"name": "Центр", "fee": "100", "min_order": "800", "polygon": SQUARE}]
        fee, zone, err = quote_delivery_for_point(
            zones=zones,
            fallback_fee="0",
            fallback_min_order="0",
            lat=55.5,
            lon=37.5,
            items_total="200",
        )
        self.assertIsNone(fee)
        self.assertIn("Минимальная", err)

    def test_quote_fallback_without_zones(self):
        fee, zone, err = quote_delivery_for_point(
            zones=[],
            fallback_fee="75",
            fallback_min_order="300",
            lat=None,
            lon=None,
            items_total="500",
        )
        self.assertIsNone(err)
        self.assertIsNone(zone)
        self.assertEqual(fee, Decimal("75.00"))
