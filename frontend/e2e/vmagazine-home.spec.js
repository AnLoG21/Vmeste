import { test, expect } from "@playwright/test";
import { installVmagazineMocks, VMAG_PRODUCT } from "./helpers/mockVmagazine.js";

test.describe("Вмагазине home", () => {
  test("/vmagazine → витрина → карточка товара", async ({ page }) => {
    await installVmagazineMocks(page);

    await page.goto("/vmagazine");
    await expect(page.getByRole("navigation", { name: "Вмагазине" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(VMAG_PRODUCT.name, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.locator(".vmag-product-card").filter({ hasText: VMAG_PRODUCT.name }).click();
    await expect(page.getByRole("heading", { name: VMAG_PRODUCT.name, exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
