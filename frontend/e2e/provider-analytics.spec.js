import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider booking analytics", () => {
  test("/analytics → GET /booking/analytics/ → KPI", async ({ page }) => {
    await installProviderMocks(page);

    let analyticsUrl = null;
    page.on("request", (req) => {
      if (req.method() === "GET" && req.url().includes("/booking/analytics")) {
        analyticsUrl = req.url();
      }
    });

    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Аналитика" })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => analyticsUrl, { timeout: 15_000 }).toBeTruthy();
    expect(analyticsUrl).toMatch(/from=/);
    expect(analyticsUrl).toMatch(/to=/);
    await expect(page.locator(".analytics-kpi-label").filter({ hasText: "Записей" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(".analytics-kpi-label").filter({ hasText: "Записей" }).locator("..")).toContainText(
      "3",
    );
  });
});
