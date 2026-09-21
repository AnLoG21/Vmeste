import { test, expect } from "@playwright/test";
import {
  installVmagazineMocks,
  VMAG_PRODUCT,
  VMAG_RETURN,
} from "./helpers/mockVmagazine.js";

test.describe("Вмагазине favorites / profile", () => {
  test("/vmagazine → Избранное показывает лайкнутый товар", async ({ page }) => {
    await installVmagazineMocks(page, {
      likes: [{ ...VMAG_PRODUCT, liked: true }],
    });

    await page.goto("/vmagazine");
    await expect(page.getByRole("navigation", { name: "Вмагазине" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("navigation", { name: "Вмагазине" }).getByRole("button", { name: "Избранное", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Избранное", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(VMAG_PRODUCT.name, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("/vmagazine → Профиль → Возвраты", async ({ page }) => {
    await installVmagazineMocks(page, {
      returns: [VMAG_RETURN],
    });

    await page.goto("/vmagazine");
    await expect(page.getByRole("navigation", { name: "Вмагазине" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("navigation", { name: "Вмагазине" }).getByRole("button", { name: "Профиль", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Профиль", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /Возвраты/i }).click();
    await expect(page.getByText(VMAG_RETURN.product_name, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Не подошёл цвет/)).toBeVisible();
  });
});
