import { test, expect } from "@playwright/test";
import { installProviderMocks, PLAN } from "./helpers/mockProvider.js";

test.describe("Subscription pay click", () => {
  test("Оплатить → promo skip → POST pay → redirect", async ({ page }) => {
    await installProviderMocks(page, { forPay: true });

    let payBody = null;
    let redirected = "";
    await page.route("https://pay.example/**", async (route) => {
      redirected = route.request().url();
      await route.fulfill({ status: 200, body: "pay" });
    });
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/subscriptions/pay")) {
        try {
          payBody = JSON.parse(req.postData() || "{}");
        } catch {
          payBody = null;
        }
      }
    });

    await page.goto("/subscriptions");
    await expect(page.getByRole("heading", { name: "Подписки" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Оплатить" }).click();
    await expect(page.getByRole("heading", { name: "Промокод" })).toBeVisible();
    await page.getByRole("button", { name: "Пропустить и оплатить" }).click();

    await expect.poll(() => payBody?.plan_id, { timeout: 15_000 }).toBe(PLAN.id);
    await expect.poll(() => redirected, { timeout: 15_000 }).toContain("pay.example/subscription");
  });
});
