"""Courier / delivery-only staff access rules."""

from django.test import SimpleTestCase

from cafe.access import delivery_only_perms, validate_courier_order_patch


class CourierAccessTests(SimpleTestCase):
    def test_delivery_only_flag(self):
        self.assertTrue(delivery_only_perms({"cafe_delivery": True}))
        self.assertFalse(delivery_only_perms({"cafe_delivery": True, "cafe_orders": True}))
        self.assertFalse(delivery_only_perms({"cafe_kitchen": True}))

    def test_courier_cannot_touch_dine_in(self):
        err = validate_courier_order_patch(
            perms={"cafe_delivery": True},
            order_mode="dine_in",
            new_status="done",
        )
        self.assertIn("доставки", err)

    def test_courier_cannot_set_cooking(self):
        err = validate_courier_order_patch(
            perms={"cafe_delivery": True},
            order_mode="delivery",
            new_status="cooking",
        )
        self.assertIn("статус", err.lower())

    def test_courier_can_set_delivering(self):
        err = validate_courier_order_patch(
            perms={"cafe_delivery": True},
            order_mode="delivery",
            new_status="delivering",
        )
        self.assertIsNone(err)

    def test_hall_staff_unrestricted_by_helper(self):
        err = validate_courier_order_patch(
            perms={"cafe_orders": True, "cafe_delivery": True},
            order_mode="dine_in",
            new_status="cooking",
        )
        self.assertIsNone(err)
