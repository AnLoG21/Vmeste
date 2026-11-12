import { describe, expect, it } from "vitest";
import { canAccessVmagnitol } from "./vmagnitolAccess.js";

describe("canAccessVmagnitol", () => {
  it("allows a.loginov150 only", () => {
    expect(canAccessVmagnitol({ username: "a.loginov150" })).toBe(true);
    expect(canAccessVmagnitol({ username: "A.Loginov150" })).toBe(true);
    expect(canAccessVmagnitol({ username: "someone" })).toBe(false);
    expect(canAccessVmagnitol(null)).toBe(false);
  });
});
