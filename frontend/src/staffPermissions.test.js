import { describe, expect, it } from "vitest";
import {
  applyStaffRolePreset,
  staffPermLabelsForSphere,
} from "./staffPermissions.js";

describe("staffPermissions", () => {
  it("labels hair_salon without marketplace/cafe/inspections", () => {
    const keys = staffPermLabelsForSphere("hair_salon").map(([k]) => k);
    expect(keys).toContain("manage_bookings");
    expect(keys).not.toContain("manage_inspections");
    expect(keys.some((k) => k.startsWith("marketplace_"))).toBe(false);
    expect(keys.some((k) => k.startsWith("cafe_"))).toBe(false);
  });

  it("labels marketplaces without booking/cafe keys", () => {
    const keys = staffPermLabelsForSphere("marketplaces").map(([k]) => k);
    expect(keys).toContain("marketplace_manage_orders");
    expect(keys).not.toContain("manage_bookings");
    expect(keys.some((k) => k.startsWith("cafe_"))).toBe(false);
  });

  it("applyStaffRolePreset sets master perms for salon", () => {
    const base = { manage_bookings: false, cafe_orders: true };
    const next = applyStaffRolePreset(base, "hair_salon", "master");
    expect(next.manage_bookings).toBe(true);
    expect(next.manage_client_chats).toBe(true);
    expect(next.manage_intervals).toBe(false);
    expect(next.cafe_orders).toBe(true);
  });
});
