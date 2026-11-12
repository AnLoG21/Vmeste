import { describe, expect, it } from "vitest";
import { pathForView, viewFromPath } from "./viewRoutes.js";

describe("viewRoutes", () => {
  it("maps service_apps ↔ /services", () => {
    expect(pathForView("service_apps")).toBe("/services");
    expect(viewFromPath("/services")).toBe("service_apps");
    expect(viewFromPath("/services/")).toBe("service_apps");
  });

  it("maps vmenu and vmagazine", () => {
    expect(pathForView("vmenu")).toBe("/vmenu");
    expect(viewFromPath("/vmenu")).toBe("vmenu");
    expect(pathForView("vmagazine")).toBe("/vmagazine");
    expect(viewFromPath("/vmagazine")).toBe("vmagazine");
  });

  it("maps vefire ↔ /vefire", () => {
    expect(pathForView("vefire")).toBe("/vefire");
    expect(viewFromPath("/vefire")).toBe("vefire");
  });

  it("maps vsayte ↔ /vsayte", () => {
    expect(pathForView("vsayte")).toBe("/vsayte");
    expect(viewFromPath("/vsayte")).toBe("vsayte");
  });

  it("maps vmagnitol ↔ /vmagnitol", () => {
    expect(pathForView("vmagnitol")).toBe("/vmagnitol");
    expect(viewFromPath("/vmagnitol")).toBe("vmagnitol");
  });

  it("returns null for unknown paths", () => {
    expect(viewFromPath("/no-such-view")).toBeNull();
    expect(pathForView("unknown")).toBe("/");
  });
});
