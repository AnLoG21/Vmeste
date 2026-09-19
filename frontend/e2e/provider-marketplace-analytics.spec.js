import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider marketplace analytics", () => {
  test("/marketplaces → Аналитика рендерится", async ({ page }) => {
    await installProviderMocks(page, { providerSphere: "marketplaces" });

    await page.goto("/marketplaces");
    await expect(page.getByRole("heading", { name: "Маркетплейсы" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Меню разделов" }).click();
    await page.getByRole("menuitem", { name: "Аналитика", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Период и фильтры", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Загрузить аналитику/i })).toBeVisible();
  });
});
