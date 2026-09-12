import { describe, expect, it } from "vitest";
import { estimateCafeGuestCharge } from "./cafeCheckoutMath.js";

describe("estimateCafeGuestCharge", () => {
  it("adds 3% service charge", () => {
    const r = estimateCafeGuestCharge({ cartTotal: 500, includeServiceCharge: true });
    expect(r.service).toBe(15);
    expect(r.total).toBe(515);
  });

  it("applies tip percent without custom tip", () => {
    const r = estimateCafeGuestCharge({
      cartTotal: 500,
      tipPercent: 10,
      includeServiceCharge: true,
    });
    expect(r.tip).toBe(50);
    expect(r.total).toBe(565);
  });

  it("uses custom tip amount", () => {
    const r = estimateCafeGuestCharge({
      cartTotal: 500,
      tipCustomMode: true,
      tipCustomAmount: 40,
      includeServiceCharge: false,
    });
    expect(r.tip).toBe(40);
    expect(r.service).toBe(0);
    expect(r.total).toBe(540);
  });

  it("includes delivery fee", () => {
    const r = estimateCafeGuestCharge({
      cartTotal: 500,
      deliveryAmount: 150,
      includeServiceCharge: true,
    });
    expect(r.delivery).toBe(150);
    expect(r.total).toBe(665);
  });
});
