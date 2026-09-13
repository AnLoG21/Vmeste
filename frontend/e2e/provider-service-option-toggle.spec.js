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

test.describe("Provider service option toggle", () => {
  test("/service-catalog → выключить доп. услугу → PATCH is_active", async ({ page }) => {
    await installProviderMocks(page, {
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
      catalogSeeded: true,
    });

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/catalog/services/301/options/401")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
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
      .locator(".service-editor-option-check input[type=checkbox]")
      .click();

    await expect.poll(() => patchBody?.is_active, { timeout: 15_000 }).toBe(false);
  });
});


