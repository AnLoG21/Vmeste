import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider catalog seed", () => {
  test("/service-catalog → Загрузить каталог услуг → POST seed-catalog", async ({ page }) => {
    await installProviderMocks(page, { catalogSeeded: false, catalogServices: [] });

    let seedPosted = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/catalog/seed-catalog")) {
        seedPosted = true;
      }
    });

    await page.goto("/service-catalog");
    await expect(page.getByRole("heading", { name: "Каталог услуг" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Загрузить каталог услуг" }).click();

    await expect.poll(() => seedPosted, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Каталог загружен/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Активно 0 из/i)).toBeVisible({ timeout: 10_000 });
  });
});
