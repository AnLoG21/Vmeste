import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const CATEGORY = {
  id: 8101,
  name: "Краски",
  parent: null,
  pool_key: "e2e_paints",
  sort_order: 0,
};

test.describe("Provider shop catalog CRUD", () => {
  test("/shop → product create/patch/delete", async ({ page }) => {
    await installProviderMocks(page, {
      providerSphere: "shops",
      shopCategories: [CATEGORY],
    });

    let productPost = null;
    let productPatch = null;
    let productDelete = false;
    page.on("request", (req) => {
      const url = req.url();
      if (req.method() === "POST" && /\/shop\/products\/?$/.test(new URL(url).pathname)) {
        try {
          productPost = JSON.parse(req.postData() || "{}");
        } catch {
          productPost = null;
        }
      }
      if (req.method() === "PATCH" && /\/shop\/products\/\d+\/?/.test(url)) {
        try {
          productPatch = JSON.parse(req.postData() || "{}");
        } catch {
          productPatch = null;
        }
      }
      if (req.method() === "DELETE" && /\/shop\/products\/\d+\/?/.test(url)) {
        productDelete = true;
      }
    });

    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "Магазин / склад" })).toBeVisible({ timeout: 20_000 });

    const form = page.locator(".right-stack");
    await form.getByLabel("Название").fill("Краска 7.1");
    await form.getByLabel("Категория").selectOption(String(CATEGORY.id));
    await form.getByLabel("Цена, ₽").fill("1200");
    await form.getByRole("button", { name: "Сохранить" }).click();

    await expect.poll(() => productPost?.name, { timeout: 15_000 }).toBe("Краска 7.1");
    expect(Number(productPost.category)).toBe(CATEGORY.id);
    await expect(page.getByText(/Товар сохранён/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Карточка товара" })).toBeVisible({ timeout: 10_000 });

    await form.getByText("В продаже").click();
    await form.getByRole("button", { name: "Сохранить" }).click();
    await expect.poll(() => productPatch?.is_active, { timeout: 15_000 }).toBe(false);

    const row = page.locator(".shop-product-row").filter({ hasText: "Краска 7.1" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: "Удалить" }).click();
    await expect(page.getByText("Удалить товар?")).toBeVisible({ timeout: 10_000 });
    await page.locator(".vmeste-confirm-ok").click();

    await expect.poll(() => productDelete, { timeout: 15_000 }).toBe(true);
    await expect(page.locator(".shop-product-row").filter({ hasText: "Краска 7.1" })).toHaveCount(0);
  });
});
