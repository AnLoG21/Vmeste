import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const CATEGORY = { id: 11, name: "Стрижки", provider: 601, subcategories: [] };
const SERVICE = {
  id: 301,
  name: "Стрижка",
  price: "1000.00",
  duration_minutes: 30,
  is_active: true,
  category: 11,
  options: [],
  gallery: [],
  photos: [],
};

test.describe("Provider service photos", () => {
  test("/service-catalog → фото услуги → POST photos", async ({ page }) => {
    await installProviderMocks(page, {
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
      catalogSeeded: true,
    });

    let uploaded = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/catalog/services/301/photos")) {
        uploaded = true;
      }
    });

    await page.goto("/service-catalog");
    await expect(page.getByRole("heading", { name: "Каталог услуг" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Стрижки/ }).click();
    await expect(page.locator(".service-editor-name strong")).toHaveText("Стрижка", { timeout: 10_000 });

    await page
      .locator(".service-editor-camera-btn input[type='file']")
      .setInputFiles({ name: "svc-e2e.png", mimeType: "image/png", buffer: PNG });

    await expect.poll(() => uploaded, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Фото услуги добавлены/i)).toBeVisible({ timeout: 10_000 });
  });
});
