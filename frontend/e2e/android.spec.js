import { test, expect } from "@playwright/test";

test.describe("Android download page", () => {
  test("shows RuStore primary, APK fallback and PWA compare", async ({ page }) => {
    await page.route("**/downloads/vmeste-android.apk", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.android.package-archive",
        body: "PK-fake-apk",
      });
    });

    await page.goto("/android");
    await expect(page.getByRole("heading", { name: "Приложение для Android" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "RuStore", exact: true })).toBeVisible();
    const store = page.getByRole("link", { name: "Открыть в RuStore" });
    await expect(store).toBeVisible();
    await expect(store).toHaveAttribute("href", /rustore\.ru\/catalog\/app\/space\.vsevmeste\.app/);
    await expect(page.getByRole("img", { name: /QR-код/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Приложение" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ярлык браузера (PWA)" })).toBeVisible();
    const apk = page.getByRole("link", { name: "Скачать APK напрямую" });
    await expect(apk).toBeVisible({ timeout: 15_000 });
    await expect(apk).toHaveAttribute("href", /\/downloads\/vmeste-android\.apk/);
  });
});
