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
};

test.describe("Provider intervals create", () => {
  test("/intervals → создать интервал → клик по дню → POST slots", async ({ page }) => {
    await installProviderMocks(page, {
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
    });

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/booking\/slots\/?$/.test(new URL(req.url()).pathname)) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/intervals");
    await expect(page.getByRole("heading", { name: "Календарь интервалов" })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator(".interval-free-form select").selectOption("anon:1");
    await page.locator(".interval-anon-service-item").filter({ hasText: "Стрижка" }).locator("input").click();
    await page.getByRole("button", { name: "Создать интервал" }).click();
    await expect(page.getByText(/Интервал сохранён/i)).toBeVisible({ timeout: 10_000 });

    await page
      .locator(".calendar-cell.clickable")
      .filter({ has: page.locator(".calendar-day", { hasText: /^15$/ }) })
      .click();

    await expect.poll(() => postBody?.starts_at, { timeout: 15_000 }).toBeTruthy();
    expect(postBody.anonymous_index).toBe(1);
    expect(postBody.service_ids).toEqual([301]);
    await expect(page.getByText(/Интервал применён/i)).toBeVisible({ timeout: 10_000 });
  });
});
