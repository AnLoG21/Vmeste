import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider cafe menu CRUD", () => {
  test("/cafe → Меню → category + item + patch + delete", async ({ page }) => {
    await installProviderMocks(page, { providerSphere: "cafe_restaurant" });

    let catPost = null;
    let itemPost = null;
    let itemPatch = null;
    let itemDelete = false;
    page.on("request", (req) => {
      const url = req.url();
      if (req.method() === "POST" && url.includes("/cafe/menu/categories/") && !/\/categories\/\d+/.test(url)) {
        try {
          catPost = JSON.parse(req.postData() || "{}");
        } catch {
          catPost = null;
        }
      }
      if (req.method() === "POST" && url.includes("/cafe/menu/items/") && !/\/items\/\d+/.test(url)) {
        try {
          itemPost = JSON.parse(req.postData() || "{}");
        } catch {
          itemPost = null;
        }
      }
      if (req.method() === "PATCH" && /\/cafe\/menu\/items\/\d+\/?/.test(url)) {
        try {
          itemPatch = JSON.parse(req.postData() || "{}");
        } catch {
          itemPatch = null;
        }
      }
      if (req.method() === "DELETE" && /\/cafe\/menu\/items\/\d+\/?/.test(url)) {
        itemDelete = true;
      }
    });

    await page.goto("/cafe");
    await expect(page.getByRole("heading", { name: "Зал и меню" })).toBeVisible({ timeout: 20_000 });
    await page.locator(".cafe-provider-tabs").getByRole("button", { name: "Меню", exact: true }).click();

    await page.getByRole("button", { name: "+ Категория" }).click();
    await expect(page.getByRole("heading", { name: "Новая категория" })).toBeVisible({ timeout: 10_000 });
    await page.locator(".cafe-form-panel").locator("label").filter({ hasText: /^Название$/ }).locator("input").fill("Супы");
    await page.locator(".cafe-form-panel").getByRole("button", { name: "Сохранить" }).click();

    await expect.poll(() => catPost?.name, { timeout: 15_000 }).toBe("Супы");
    await expect(page.getByRole("heading", { name: "Супы" })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "+ Блюдо" }).click();
    await expect(page.getByRole("heading", { name: "Новое блюдо" })).toBeVisible({ timeout: 10_000 });
    const itemForm = page.locator(".cafe-form-panel").filter({ hasText: "Новое блюдо" });
    await itemForm.locator("label").filter({ hasText: /Название/ }).locator("input").fill("Борщ");
    await itemForm.locator("label").filter({ hasText: /Цена/ }).locator("input").fill("450");
    await itemForm.getByRole("button", { name: "Добавить" }).click();

    await expect.poll(() => itemPost?.name, { timeout: 15_000 }).toBe("Борщ");
    expect(Number(itemPost.category)).toBeTruthy();

    const itemRow = page.locator(".cafe-item-row").filter({ has: page.locator('input[value="Борщ"]') });
    await expect(itemRow).toBeVisible({ timeout: 10_000 });
    await itemRow.getByText("В наличии").click();
    await expect.poll(() => itemPatch?.is_available, { timeout: 15_000 }).toBe(false);

    await itemRow.getByRole("button", { name: "Удалить блюдо" }).click();
    await expect(page.getByText("Удалить блюдо?")).toBeVisible({ timeout: 10_000 });
    await page.locator(".vmeste-confirm-ok").click();

    await expect.poll(() => itemDelete, { timeout: 15_000 }).toBe(true);
    await expect(page.locator(".cafe-item-row").filter({ has: page.locator('input[value="Борщ"]') })).toHaveCount(0);
  });
});
