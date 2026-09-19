import { test, expect } from "@playwright/test";
import { installVmagazineMocks, VMAG_PRODUCT } from "./helpers/mockVmagazine.js";

test.describe("Вмагазине cart", () => {
  test("/vmagazine → в корзину → вкладка Корзина", async ({ page }) => {
    await installVmagazineMocks(page);

    const posts = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/vmagazine/cart")) {
        posts.push(req.postData() || "");
      }
    });

    await page.goto("/vmagazine");
    await expect(page.getByText(VMAG_PRODUCT.name, { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page
      .locator(".vmag-product-card")
      .filter({ hasText: VMAG_PRODUCT.name })
      .getByRole("button", { name: "В корзину" })
      .click();

    await expect.poll(() => posts.length, { timeout: 15_000 }).toBeGreaterThan(0);

    await page.getByRole("button", { name: /Корзина/ }).click();
    await expect(page.getByRole("heading", { name: "Корзина", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(VMAG_PRODUCT.name, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });
});
