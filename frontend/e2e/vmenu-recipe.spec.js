import { test, expect } from "@playwright/test";
import { installVmenuMocks } from "./helpers/mockVmenu.js";

test.describe("Вменю recipe create", () => {
  test("/vmenu → профиль → опубликовать рецепт", async ({ page }) => {
    await installVmenuMocks(page);

    const creates = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/vmenu\/recipes\/?$/.test(new URL(req.url()).pathname)) {
        creates.push(req.url());
      }
    });

    await page.goto("/vmenu");
    await expect(page.getByRole("heading", { name: "Вменю", exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /Профиль/ }).click();
    await expect(page.getByRole("button", { name: "+ Опубликовать рецепт" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "+ Опубликовать рецепт" }).click();

    await expect(page.getByRole("heading", { name: "Новый рецепт", exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await page.locator(".vmenu-field-block").filter({ hasText: "Название" }).locator("input").fill("Оливье E2E");
    await page.getByRole("button", { name: "Опубликовать", exact: true }).click();

    await expect.poll(() => creates.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: "Новый рецепт", exact: true })).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
