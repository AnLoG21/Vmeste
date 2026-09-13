import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client request password reset", () => {
  test("/settings → Сбросить через почту → POST request-password-reset", async ({ page }) => {
    await installClientMocks(page);

    let posted = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/users/request-password-reset")) {
        posted = true;
      }
    });

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Смена пароля" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Сбросить через почту" }).click();

    await expect.poll(() => posted, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/ссылк|почт/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
