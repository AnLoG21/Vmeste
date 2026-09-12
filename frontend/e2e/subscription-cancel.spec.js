import { test, expect } from "@playwright/test";
import { installProviderMocks, ACTIVE_SUB } from "./helpers/mockProvider.js";

test.describe("Subscription cancel", () => {
  test("Отключить подписку → POST cancel immediate=false", async ({ page }) => {
    await installProviderMocks(page);

    let cancelBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/subscriptions/cancel")) {
        try {
          cancelBody = JSON.parse(req.postData() || "{}");
        } catch {
          cancelBody = null;
        }
      }
    });

    await page.goto("/subscriptions");
    await expect(page.getByRole("heading", { name: "Подписки" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Бизнес").first()).toBeVisible();

    await page.getByRole("button", { name: "Отключить подписку" }).click();
    await expect(page.locator(".vmeste-confirm-backdrop")).toBeVisible();
    await page.locator(".vmeste-confirm-ok").click();

    await expect.poll(() => cancelBody, { timeout: 15_000 }).toMatchObject({
      subscription_id: ACTIVE_SUB.id,
      immediate: false,
    });
    await expect(page.locator(".status")).toContainText("Автопродление отключено", {
      timeout: 15_000,
    });
  });
});
