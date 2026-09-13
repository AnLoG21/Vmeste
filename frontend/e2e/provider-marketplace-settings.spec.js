import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider marketplace settings", () => {
  test("/marketplaces → Настройки → save notify toggles", async ({ page }) => {
    await installProviderMocks(page, { providerSphere: "marketplaces" });

    const patches = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/marketplaces/settings")) {
        try {
          patches.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/marketplaces");
    await expect(page.getByRole("heading", { name: "Маркетплейсы" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Меню разделов" }).click();
    await page.getByRole("menuitem", { name: "Настройки", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Уведомления Telegram / push" })).toBeVisible({
      timeout: 10_000,
    });

    const telegram = page.getByRole("checkbox", { name: /Telegram/i });
    await expect(telegram).toBeChecked();
    await telegram.click();
    await expect(telegram).not.toBeChecked();

    await page.getByRole("button", { name: "Сохранить уведомления" }).click();
    await expect
      .poll(() => patches.some((p) => p.notify_telegram === false), { timeout: 15_000 })
      .toBe(true);
    await expect(page.getByText(/Ключи сохранены/i)).toBeVisible({ timeout: 10_000 });
  });
});
