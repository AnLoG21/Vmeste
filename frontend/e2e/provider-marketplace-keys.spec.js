import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider marketplace keys", () => {
  test("/marketplaces → Настройки → Боевой → Сохранить ключи", async ({ page }) => {
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
    await expect(page.getByRole("heading", { name: "Ключи площадок" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByLabel("Режим работы").selectOption("prod");
    await page.getByRole("button", { name: "Сохранить ключи" }).click();

    await expect
      .poll(() => patches.some((p) => p.environment === "prod"), { timeout: 15_000 })
      .toBe(true);
    await expect(page.getByLabel("Режим работы")).toHaveValue("prod");
    await expect(page.getByText(/Боевой режим/)).toBeVisible({ timeout: 10_000 });
  });
});
