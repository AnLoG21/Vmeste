"""Delivery zone point-in-polygon."""

from django.test import SimpleTestCase

from cafe.delivery_zones import find_delivery_zone, normalize_delivery_zones, point_in_polygon


class DeliveryZonesTests(SimpleTestCase):
    def test_point_inside_square(self):
        square = [[55.0, 37.0], [55.0, 38.0], [56.0, 38.0], [56.0, 37.0]]
        self.assertTrue(point_in_polygon(55.5, 37.5, square))
        self.assertFalse(point_in_polygon(54.5, 37.5, square))

    def test_find_zone(self):
        zones = normalize_delivery_zones(
            [
                {
                    "name": "Центр",
                    "fee": "200",
                    "min_order": "500",
                    "polygon": [[55.0, 37.0], [55.0, 38.0], [56.0, 38.0], [56.0, 37.0]],
                }
            ]
        )
        z = find_delivery_zone(55.5, 37.5, zones)
        self.assertIsNotNone(z)
        self.assertEqual(z["name"], "Центр")
        self.assertEqual(z["fee"], "200.00")
        self.assertIsNone(find_delivery_zone(50.0, 30.0, zones))
