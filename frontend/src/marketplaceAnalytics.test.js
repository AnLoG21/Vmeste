import { describe, expect, it } from "vitest";
import {
  aggregateBuhRows,
  calcSppSupplierPrice,
  calcUnitEconomics,
  extractRecords,
} from "./marketplaceAnalytics.js";

describe("marketplaceAnalytics", () => {
  it("extractRecords unwraps common envelopes", () => {
    expect(extractRecords(null)).toEqual([]);
    expect(extractRecords([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(extractRecords({ data: [{ b: 2 }] })).toEqual([{ b: 2 }]);
    expect(extractRecords({ cards: [{ c: 3 }] })).toEqual([{ c: 3 }]);
  });

  it("aggregateBuhRows sums sales", () => {
    const agg = aggregateBuhRows([
      {
        sa_name: "SKU-1",
        quantity: 2,
        retail_amount: 1000,
        ppvz_for_pay: 800,
        supplier_oper_name: "Продажа",
        rr_dt: "2026-03-01",
        brand_name: "Brand",
      },
    ]);
    expect(agg.kpis.qty_sale).toBe(2);
    expect(agg.kpis.orders_sum).toBe(1000);
    expect(agg.by_sku[0].sku).toBe("SKU-1");
  });

  it("calcUnitEconomics returns margin", () => {
    const u = calcUnitEconomics({
      price: 1000,
      cost: 400,
      commissionPct: 10,
      logistics: 50,
      buyoutPct: 100,
    });
    expect(u.revenue).toBe(1000);
    expect(u.commission).toBe(100);
    expect(u.margin).toBe(450);
  });

  it("calcSppSupplierPrice derives supplier price", () => {
    expect(calcSppSupplierPrice(900, 10)).toBe(1000);
    expect(calcSppSupplierPrice(0, 10)).toBeNull();
  });
});
