"""Unit tests for WB report normalize + SPP reprice + sku_costs settings."""

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from marketplaces.models import MarketplaceSettings
from marketplaces.spp_reprice import calc_supplier_price_for_target_buyer, plan_spp_update, should_reprice
from marketplaces.views import MarketplaceSettingsView
from marketplaces.wb_report import aggregate_buh_rows, normalize_buh_row


User = get_user_model()


class WbReportNormalizeTests(SimpleTestCase):
    def test_normalize_sale(self):
        row = normalize_buh_row(
            {
                "sa_name": "SKU-1",
                "nm_id": 111,
                "brand_name": "Brand",
                "supplier_oper_name": "Продажа",
                "quantity": 2,
                "retail_amount": 2000,
                "ppvz_for_pay": 1500,
                "ppvz_sales_commission": 200,
                "delivery_rub": 50,
                "storage_fee": 10,
                "rr_dt": "2026-08-01",
            }
        )
        self.assertTrue(row["is_sale"])
        self.assertEqual(row["sku"], "SKU-1")
        self.assertEqual(row["for_pay"], 1500)

    def test_aggregate_kpis(self):
        agg = aggregate_buh_rows(
            [
                {
                    "sa_name": "A",
                    "supplier_oper_name": "Продажа",
                    "quantity": 1,
                    "retail_amount": 100,
                    "ppvz_for_pay": 80,
                    "delivery_rub": 5,
                    "storage_fee": 0,
                    "rr_dt": "2026-08-01",
                },
                {
                    "sa_name": "A",
                    "supplier_oper_name": "Возврат",
                    "quantity": 1,
                    "retail_amount": 100,
                    "ppvz_for_pay": 80,
                    "rr_dt": "2026-08-02",
                },
            ]
        )
        self.assertEqual(agg["kpis"]["qty_sale"], 1)
        self.assertEqual(agg["kpis"]["qty_return"], 1)
        self.assertEqual(agg["kpis"]["for_pay"], 0)


class SppRepriceTests(SimpleTestCase):
    def test_calc_price(self):
        # target 800 with 20% spp → 1000
        self.assertEqual(calc_supplier_price_for_target_buyer(target_buyer_price=800, spp_percent=20), 1000)

    def test_should_reprice(self):
        self.assertTrue(should_reprice(client_price=800, supplier_price=1000, spp_percent=20))
        self.assertFalse(should_reprice(client_price=1000, supplier_price=1000, spp_percent=0))

    def test_plan(self):
        plan = plan_spp_update(
            {"offer_id": "SKU", "nm_id": "1", "target_buyer_price": 800, "supplier_discount": 0},
            {"spp_percent": 20, "supplier_price": 900, "client_price": 720, "current_price": 900},
        )
        self.assertIsNotNone(plan)
        self.assertEqual(plan["new_price"], 1000)
        self.assertTrue(plan["needs_change"])


class SkuCostsSettingsApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.provider = User.objects.create_user(
            username="mp_costs",
            email="mp_costs@example.com",
            password="test-pass-123",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.MARKETPLACES,
        )
        MarketplaceSettings.objects.create(provider=self.provider, environment="sandbox")

    def test_patch_sku_costs_round_trip(self):
        req = self.factory.patch(
            "/api/marketplaces/settings/",
            {"sku_costs": {"ozon:SKU-1": 120.5, "wildberries:A": 99}},
            format="json",
        )
        force_authenticate(req, user=self.provider)
        resp = MarketplaceSettingsView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["sku_costs"]["ozon:SKU-1"], 120.5)
        self.assertEqual(resp.data["sku_costs"]["wildberries:A"], 99.0)

        req2 = self.factory.get("/api/marketplaces/settings/")
        force_authenticate(req2, user=self.provider)
        resp2 = MarketplaceSettingsView.as_view()(req2)
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["sku_costs"]["ozon:SKU-1"], 120.5)
