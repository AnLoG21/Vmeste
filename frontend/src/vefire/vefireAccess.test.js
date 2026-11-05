import { describe, expect, it } from "vitest";
import { canAccessVefire } from "./vefireAccess.js";

describe("canAccessVefire", () => {
  it("allows a.loginov150 only", () => {
    expect(canAccessVefire({ username: "a.loginov150" })).toBe(true);
    expect(canAccessVefire({ username: "A.Loginov150" })).toBe(true);
    expect(canAccessVefire({ username: "someone" })).toBe(false);
    expect(canAccessVefire(null)).toBe(false);
  });
});
