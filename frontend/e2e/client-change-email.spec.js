import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client change email", () => {
  test("/settings → Сменить email → POST change-email", async ({ page }) => {
    await installClientMocks(page);

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/users/change-email")) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Смена почты" })).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder("Новый email").fill("new-e2e@example.com");
    await page.getByRole("button", { name: "Сменить email" }).click();

    await expect.poll(() => postBody?.new_email, { timeout: 15_000 }).toBe("new-e2e@example.com");
    await expect(page.getByText(/Email изменён|письм/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
