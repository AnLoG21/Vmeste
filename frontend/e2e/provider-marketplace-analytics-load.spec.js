import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider marketplace analytics load", () => {
  test("/marketplaces → Аналитика → Загрузить", async ({ page }) => {
    await installProviderMocks(page, { providerSphere: "marketplaces" });

    const calls = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/marketplaces/call")) {
        calls.push(req.postData() || "");
      }
    });

    await page.goto("/marketplaces");
    await expect(page.getByRole("heading", { name: "Маркетплейсы" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Меню разделов" }).click();
    await page.getByRole("menuitem", { name: "Аналитика", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Период и фильтры", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /Загрузить аналитику/i }).click();

    await expect.poll(() => calls.some((b) => b.includes("analytics.")), { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Аналитика .*SKU/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".mp-kpi-label").filter({ hasText: "Заказы / розница" })).toBeVisible({
      timeout: 10_000,
    });
  });
});
