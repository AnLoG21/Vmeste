"""HTTP: cafe provider order status PATCH."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from cafe.models import CafeMenuCategory, CafeMenuItem, CafeOrder, CafeOrderItem
from users.models import User


class CafeOrdersStatusApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="cafe-orders-status",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.CAFE_RESTAURANT,
            organization_name="Кафе Orders",
            organization_slug="cafe-orders-status",
        )
        cat = CafeMenuCategory.objects.create(provider=self.provider, name="Напитки")
        item = CafeMenuItem.objects.create(
            category=cat,
            name="Латте",
            price=Decimal("350.00"),
            is_active=True,
            is_available=True,
        )
        self.order = CafeOrder.objects.create(
            provider=self.provider,
            mode=CafeOrder.Mode.DINE_IN,
            status=CafeOrder.Status.ACCEPTED,
            pay_method=CafeOrder.PayMethod.CASH,
            guest_name="Гость",
            items_total=Decimal("350.00"),
            total=Decimal("350.00"),
            provider_payout_amount=Decimal("350.00"),
        )
        CafeOrderItem.objects.create(
            order=self.order,
            menu_item=item,
            name=item.name,
            unit_price=item.price,
            quantity=1,
        )
        self.api.force_authenticate(self.provider)

    def test_status_cooking_ready_done(self):
        cooking = self.api.patch(
            f"/api/cafe/orders/{self.order.id}/",
            {"status": "cooking"},
            format="json",
        )
        self.assertEqual(cooking.status_code, 200, cooking.data)
        self.assertEqual(cooking.data.get("status"), "cooking")

        ready = self.api.patch(
            f"/api/cafe/orders/{self.order.id}/",
            {"status": "ready"},
            format="json",
        )
        self.assertEqual(ready.status_code, 200, ready.data)
        self.assertEqual(ready.data.get("status"), "ready")

        done = self.api.patch(
            f"/api/cafe/orders/{self.order.id}/",
            {"status": "done"},
            format="json",
        )
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(done.data.get("status"), "done")
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, CafeOrder.Status.DONE)

    def test_invalid_status_rejected(self):
        res = self.api.patch(
            f"/api/cafe/orders/{self.order.id}/",
            {"status": "not_a_status"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)

    def test_client_forbidden(self):
        client = User.objects.create_user(
            username="client-cafe-orders",
            password="x",
            role=User.Role.CLIENT,
        )
        self.api.force_authenticate(client)
        res = self.api.patch(
            f"/api/cafe/orders/{self.order.id}/",
            {"status": "cooking"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
