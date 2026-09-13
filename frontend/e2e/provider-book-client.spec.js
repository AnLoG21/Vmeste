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

test.describe("Provider book for client", () => {
  test("/intervals → Записать клиента → POST book-for-client", async ({ page }) => {
    await installProviderMocks(page, {
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
    });

    let bookBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/booking/book-for-client")) {
        try {
          bookBody = JSON.parse(req.postData() || "{}");
        } catch {
          bookBody = null;
        }
      }
    });

    await page.goto("/intervals");
    await expect(page.getByRole("heading", { name: "Календарь интервалов" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Записать клиента" }).click();
    await expect(page.getByRole("heading", { name: "Записать клиента" })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByPlaceholder("Как обращаться").fill("Мария Новая");
    await page.locator(".provider-book-client-form select").selectOption("301");
    await page.locator(".provider-book-client-form").getByRole("button", { name: "Записать", exact: true }).click();

    await expect.poll(() => bookBody?.name, { timeout: 15_000 }).toBe("Мария Новая");
    expect(Number(bookBody.service)).toBe(301);
    expect(bookBody.starts_at).toBeTruthy();
    await expect(page.locator(".vmeste-toast-text")).toContainText(/Клиент записан/i, {
      timeout: 10_000,
    });
  });
});
