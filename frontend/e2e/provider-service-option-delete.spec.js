import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const CATEGORY = { id: 11, name: "Стрижки", provider: 601, subcategories: [] };
const SERVICE = {
  id: 301,
  name: "Стрижка",
  price: "1000.00",
  duration_minutes: 30,
  is_active: true,
  category: 11,
  options: [
    {
      id: 401,
      name: "Мойка",
      price: "200.00",
      extra_minutes: 10,
      is_active: true,
      photos: [],
    },
  ],
  gallery: [],
  photos: [],
};

test.describe("Provider service option delete", () => {
  test("/service-catalog → Удалить опцию → DELETE", async ({ page }) => {
    await installProviderMocks(page, {
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
      catalogSeeded: true,
    });

    let deleted = false;
    page.on("request", (req) => {
      if (req.method() === "DELETE" && req.url().includes("/catalog/services/301/options/401")) {
        deleted = true;
      }
    });

    await page.goto("/service-catalog");
    await expect(page.getByRole("heading", { name: "Каталог услуг" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Стрижки/ }).click();
    await expect(page.locator(".service-editor-option-block .service-editor-option-name-input")).toHaveValue(
      "Мойка",
      { timeout: 10_000 },
    );

    await page
      .locator(".service-editor-option-block")
      .filter({ has: page.locator('.service-editor-option-name-input[value="Мойка"]') })
      .getByRole("button", { name: "Удалить" })
      .click();

    await expect(page.getByText("Удалить опцию?")).toBeVisible({ timeout: 10_000 });
    await page.locator(".vmeste-confirm-ok").click();

    await expect.poll(() => deleted, { timeout: 15_000 }).toBe(true);
    await expect(page.locator('.service-editor-option-name-input[value="Мойка"]')).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
