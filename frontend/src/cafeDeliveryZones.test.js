import { describe, expect, it } from "vitest";
import { findZoneAt } from "./CafeGuestDeliveryMap.jsx";

const SQUARE = [
  [55.0, 37.0],
  [55.0, 38.0],
  [56.0, 38.0],
  [56.0, 37.0],
];

describe("findZoneAt", () => {
  it("returns matching zone inside polygon", () => {
    const zones = [{ id: "z1", name: "Центр", fee: 150, min_order: 400, polygon: SQUARE }];
    const z = findZoneAt(55.5, 37.5, zones);
    expect(z?.id).toBe("z1");
  });

  it("returns null outside polygon", () => {
    const zones = [{ id: "z1", name: "Центр", fee: 150, polygon: SQUARE }];
    expect(findZoneAt(50.0, 30.0, zones)).toBeNull();
  });
});
