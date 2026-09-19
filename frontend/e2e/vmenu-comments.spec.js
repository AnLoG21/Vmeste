import { test, expect } from "@playwright/test";
import { installVmenuMocks, VMENU_RECIPE } from "./helpers/mockVmenu.js";

test.describe("Вменю comments", () => {
  test("/vmenu → рецепт → комментарий → like", async ({ page }) => {
    await installVmenuMocks(page);

    const posts = [];
    page.on("request", (req) => {
      const u = req.url();
      if (req.method() === "POST" && u.includes("/comments")) {
        posts.push(u);
      }
    });

    await page.goto("/vmenu");
    await expect(page.getByRole("heading", { name: "Вменю", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("heading", { name: VMENU_RECIPE.title, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Комментарии", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByPlaceholder("Комментарий…").fill("Очень вкусно E2E");
    await page.getByRole("button", { name: "Отправить" }).click();

    await expect.poll(() => posts.some((u) => /\/comments\/?$/.test(u.replace(/\?.*$/, "")) || u.includes("/comments")), {
      timeout: 15_000,
    }).toBe(true);
    await expect(page.getByText("Очень вкусно E2E")).toBeVisible({ timeout: 10_000 });

    await page.locator(".vmenu-comment-like").first().click();
    await expect
      .poll(() => posts.some((u) => u.includes("/like")), { timeout: 15_000 })
      .toBe(true);
  });
});
