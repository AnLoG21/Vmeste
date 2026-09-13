import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client resend verification", () => {
  test("/settings → Отправить письмо повторно → POST resend-verification", async ({ page }) => {
    await installClientMocks(page, {
      meOverrides: { email_verified: false, email: "e2e@example.com" },
    });

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/users/resend-verification")) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/settings");
    await expect(page.getByText(/Подтверди email/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Отправить письмо повторно" }).click();

    await expect.poll(() => postBody?.email, { timeout: 15_000 }).toBe("e2e@example.com");
    await expect(page.getByText(/Письмо отправлено|отправ/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
