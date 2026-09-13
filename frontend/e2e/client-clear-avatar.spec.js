import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client clear avatar", () => {
  test("/cabinet → Удалить аватар → POST clear_avatar", async ({ page }) => {
    await installClientMocks(page, {
      meOverrides: {
        avatar_url: "https://example.com/e2e-avatar.png",
        avatar_thumb_url: "https://example.com/e2e-avatar-thumb.png",
      },
    });

    let cleared = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/users\/me\/?$/.test(new URL(req.url()).pathname)) {
        const data = req.postData() || "";
        if (data.includes("clear_avatar")) cleared = true;
      }
    });

    await page.goto("/cabinet");
    await expect(page.getByRole("heading", { name: "Личный кабинет" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(".profile-avatar img")).toBeVisible();

    await page.locator(".profile-avatar-actions").getByRole("button", { name: "Удалить" }).click();

    await expect.poll(() => cleared, { timeout: 15_000 }).toBe(true);
    await expect(page.locator(".profile-avatar img")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText(/Аватар удалён/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
