import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider marketplace catalog sync", () => {
  test("/marketplaces → Товары → Подтянуть с площадки", async ({ page }) => {
    await installProviderMocks(page, { providerSphere: "marketplaces" });

    const syncPosts = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/products/sync-catalog")) {
        syncPosts.push(req.postData() || "");
      }
    });

    await page.goto("/marketplaces");
    await expect(page.getByRole("heading", { name: "Маркетплейсы" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Меню разделов" }).click();
    await page.getByRole("menuitem", { name: "Товары", exact: true }).click();
    await expect(page.getByRole("button", { name: "Подтянуть с площадки" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Подтянуть с площадки" }).click();

    await expect.poll(() => syncPosts.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByText(/Каталог подтянут/i)).toBeVisible({ timeout: 10_000 });
  });
});
