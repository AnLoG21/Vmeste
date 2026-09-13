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
const CLIENT = {
  id: 703,
  name: "Анна Поиск",
  phone: "+79007778899",
  avatar_url: "",
  avatar_initial: "А",
  visits_done: 3,
};

test.describe("Provider client picker lookup", () => {
  test("/intervals → Записать → поиск клиента → POST book-for-client", async ({ page }) => {
    await installProviderMocks(page, {
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
      clients: [CLIENT],
    });

    let lookupQ = null;
    let bookBody = null;
    page.on("request", (req) => {
      if (req.method() === "GET" && req.url().includes("/booking/clients/lookup")) {
        try {
          lookupQ = new URL(req.url()).searchParams.get("q");
        } catch {
          lookupQ = null;
        }
      }
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

    await page.getByPlaceholder("Анна или +7…").fill("Анна");
    await expect.poll(() => lookupQ, { timeout: 15_000 }).toBe("Анна");
    await page.locator(".client-picker-suggestion").filter({ hasText: "Анна Поиск" }).click();
    await page.locator(".client-picker-add-btn").click();
    await expect(page.locator(".client-picker-selected")).toContainText("Анна Поиск");

    await page.locator(".provider-book-client-form select").selectOption("301");
    await page.locator(".provider-book-client-form").getByRole("button", { name: "Записать", exact: true }).click();

    await expect.poll(() => bookBody?.client, { timeout: 15_000 }).toBe(703);
    expect(Number(bookBody.service)).toBe(301);
    await expect(page.locator(".vmeste-toast-text")).toContainText(/Клиент записан/i, {
      timeout: 10_000,
    });
  });
});
