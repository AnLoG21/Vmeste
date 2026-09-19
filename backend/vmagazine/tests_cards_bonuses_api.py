"""HTTP: Вмагазине payment-cards + bonuses."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User
from vmagazine.models import SavedPaymentCard, ShopBonusBalance


class VmagazineCardsBonusesApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.buyer = User.objects.create_user(
            username="vmag-card-buyer",
            password="x",
            role=User.Role.CLIENT,
            email="vmag-card-buyer@example.com",
        )
        self.shop = User.objects.create_user(
            username="vmag-card-shop",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.SHOPS,
            organization_name="Лавка Cards",
            organization_slug="vmag-card-shop",
        )
        self.api.force_authenticate(self.buyer)

    def test_payment_cards_get_and_post(self):
        empty = self.api.get("/api/vmagazine/payment-cards/")
        self.assertEqual(empty.status_code, 200, empty.data)
        self.assertEqual(empty.data, [])

        created = self.api.post(
            "/api/vmagazine/payment-cards/",
            {"number": "4111111111111111", "exp_month": 12, "exp_year": 2030},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data.get("last4"), "1111")
        self.assertTrue(SavedPaymentCard.objects.filter(user=self.buyer, last4="1111").exists())

        listed = self.api.get("/api/vmagazine/payment-cards/")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)

    def test_bonuses_list(self):
        ShopBonusBalance.objects.create(user=self.buyer, provider=self.shop, balance=Decimal("50.00"))
        res = self.api.get("/api/vmagazine/bonuses/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0].get("provider_id"), self.shop.id)
        self.assertEqual(str(res.data[0].get("balance")), "50.00")
