import { test, expect } from "@playwright/test";

test.describe("Android download page", () => {
  test("shows APK vs PWA and download CTA", async ({ page }) => {
    await page.route("**/downloads/vmeste-android.apk", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.android.package-archive",
        body: "PK-fake-apk",
      });
    });

    await page.goto("/android");
    await expect(page.getByRole("heading", { name: "Приложение для Android" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Приложение (APK)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ярлык браузера (PWA)" })).toBeVisible();
    const cta = page.getByRole("link", { name: "Скачать APK" });
    await expect(cta).toBeVisible({ timeout: 15_000 });
    await expect(cta).toHaveAttribute("href", /\/downloads\/vmeste-android\.apk/);
  });
});
