import { test, expect } from "@playwright/test";
import { installVmenuMocks, VMENU_RECIPE } from "./helpers/mockVmenu.js";

test.describe("Вменю search / social", () => {
  test("/vmenu → Поиск → открыть → like/save", async ({ page }) => {
    await installVmenuMocks(page);

    const socialPosts = [];
    page.on("request", (req) => {
      const u = req.url();
      if (req.method() === "POST" && (u.includes("/like") || u.includes("/save"))) {
        socialPosts.push(u);
      }
    });

    await page.goto("/vmenu");
    await expect(page.getByRole("heading", { name: "Вменю", exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /Поиск/ }).click();
    await expect(page.getByRole("heading", { name: "Поиск рецептов", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByPlaceholder("Название, ингредиент…").fill("Борщ");
    await page.getByRole("button", { name: "Найти" }).click();

    await expect(page.getByRole("heading", { name: VMENU_RECIPE.title, exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("heading", { name: VMENU_RECIPE.title, exact: true }).click();
    await expect(page.getByText("Свёкла")).toBeVisible({ timeout: 10_000 });

    await page.locator(".vmenu-card-actions button").filter({ hasText: "♥" }).first().click();
    await page.locator(".vmenu-card-actions button").filter({ hasText: "↪" }).first().click();

    await expect.poll(() => socialPosts.some((u) => u.includes("/like")), { timeout: 15_000 }).toBe(
      true,
    );
    await expect.poll(() => socialPosts.some((u) => u.includes("/save")), { timeout: 15_000 }).toBe(
      true,
    );
  });
});
