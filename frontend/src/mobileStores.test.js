import { describe, expect, it } from "vitest";
import { ANDROID_APK_URL, ANDROID_PACKAGE_ID, RUSTORE_APP_URL, rustoreQrUrl } from "./mobileStores.js";

describe("mobileStores", () => {
  it("points RuStore URL at package id", () => {
    expect(ANDROID_PACKAGE_ID).toBe("space.vsevmeste.app");
    expect(RUSTORE_APP_URL).toContain(ANDROID_PACKAGE_ID);
    expect(RUSTORE_APP_URL).toMatch(/^https:\/\/www\.rustore\.ru\/catalog\/app\//);
  });

  it("exposes APK path", () => {
    expect(ANDROID_APK_URL).toBe("/downloads/vmeste-android.apk");
  });

  it("builds QR url with encoded RuStore link", () => {
    const url = rustoreQrUrl(160);
    expect(url).toContain("api.qrserver.com");
    expect(url).toContain("160x160");
    expect(url).toContain(encodeURIComponent(RUSTORE_APP_URL));
  });

  it("clamps QR size", () => {
    expect(rustoreQrUrl(10)).toContain("120x120");
    expect(rustoreQrUrl(999)).toContain("320x320");
  });
});
