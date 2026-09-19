import { test, expect } from "@playwright/test";
import { installVmenuMocks, VMENU_RECIPE } from "./helpers/mockVmenu.js";

test.describe("Вменю feed", () => {
  test("/vmenu → лента → открыть рецепт", async ({ page }) => {
    await installVmenuMocks(page);

    await page.goto("/vmenu");
    await expect(page.getByRole("heading", { name: "Вменю", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: VMENU_RECIPE.title, exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("heading", { name: VMENU_RECIPE.title, exact: true }).click();
    await expect(page.getByRole("heading", { name: VMENU_RECIPE.title, exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Свёкла")).toBeVisible({ timeout: 10_000 });
  });
});
