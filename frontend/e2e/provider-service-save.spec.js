import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const CATEGORY = { id: 11, name: "Стрижки", provider: 601, subcategories: [] };
const SERVICE = {
  id: 301,
  name: "Стрижка",
  price: "0.00",
  duration_minutes: 30,
  is_active: false,
  category: 11,
  options: [],
  gallery: [],
};

test.describe("Provider catalog service save", () => {
  test("/service-catalog → Оказываем → Сохранить все изменения → PATCH", async ({ page }) => {
    await installProviderMocks(page, {
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
      catalogSeeded: true,
    });

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/catalog/services/301")) {
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
    await expect(page.getByText("Стрижка")).toBeVisible({ timeout: 10_000 });

    await page.locator(".service-editor-active").filter({ hasText: "Оказываем" }).locator("input[type=checkbox]").click();
    await page.getByRole("button", { name: /Сохранить все изменения/ }).click();

    await expect.poll(() => patchBody?.is_active, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Сохранено услуг/i)).toBeVisible({ timeout: 10_000 });
  });
});
