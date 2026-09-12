import { describe, expect, it } from "vitest";
import { estimateClientBookCharge } from "./bookingDisplay.jsx";

const service = { price: 1000, options: [] };

describe("estimateClientBookCharge", () => {
  it("covers full amount with loyalty points", () => {
    const r = estimateClientBookCharge({
      service,
      loyaltyPoints: 1000,
      rubPerPoint: 1,
      prepay: { ready: true, mode: "full" },
    });
    expect(r.charge).toBe(0);
    expect(r.coveredByLoyalty).toBe(true);
    expect(r.submitLabel).toMatch(/баллами/);
  });

  it("charges percent prepay when payable remains", () => {
    const r = estimateClientBookCharge({
      service,
      loyaltyPoints: 0,
      prepay: { ready: true, mode: "percent", percent: 50 },
    });
    expect(r.total).toBe(1000);
    expect(r.charge).toBe(500);
    expect(r.coveredByLoyalty).toBe(false);
    expect(r.submitLabel).toMatch(/оплате/);
  });

  it("uses package path without loyalty flag", () => {
    const r = estimateClientBookCharge({
      service,
      usePackage: true,
      hasPackages: true,
      prepay: { ready: true, mode: "full" },
    });
    expect(r.charge).toBe(0);
    expect(r.coveredByLoyalty).toBe(false);
    expect(r.submitLabel).toMatch(/абонементу/);
  });

  it("zero price service needs no card", () => {
    const r = estimateClientBookCharge({
      service: { price: 0, options: [] },
      prepay: { ready: true, mode: "full" },
    });
    expect(r.charge).toBe(0);
    expect(r.coveredByLoyalty).toBe(false);
  });
});
