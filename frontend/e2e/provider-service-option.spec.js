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
  options: [],
  gallery: [],
  photos: [],
};

test.describe("Provider service options", () => {
  test("/service-catalog → добавить доп. услугу → POST options", async ({ page }) => {
    await installProviderMocks(page, {
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
      catalogSeeded: true,
    });

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/catalog/services/301/options")) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/service-catalog");
    await expect(page.getByRole("heading", { name: "Каталог услуг" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Стрижки/ }).click();
    await expect(page.getByText("Доп. услуги")).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Название допа").fill("Мытьё головы");
    await page.locator(".service-editor-option-form").getByPlaceholder("0").first().fill("200");
    await page.locator(".service-editor-option-form").getByRole("button", { name: "Добавить" }).click();

    await expect.poll(() => postBody?.name, { timeout: 15_000 }).toBe("Мытьё головы");
    expect(Number(postBody.price)).toBe(200);
    await expect(page.locator(".vmeste-toast-text")).toContainText(/Доп\. услуга добавлена/i, {
      timeout: 10_000,
    });
  });
});
