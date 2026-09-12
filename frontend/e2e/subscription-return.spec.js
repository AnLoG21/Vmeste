import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Subscription payment return", () => {
  test("?payment=success confirms and opens Подписки", async ({ page }) => {
    await installProviderMocks(page);
    await page.goto("/subscriptions?payment=success&payment_id=42");
    await expect(page.getByRole("heading", { name: "Подписки" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".verify-note")).toContainText("Оплата подтверждена");
    await expect(page.getByText("Бизнес").first()).toBeVisible();
  });
});
