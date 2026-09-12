import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Subscription promo", () => {
  test("Оплатить → Применить VSEVMESTE → no pay redirect", async ({ page }) => {
    await installProviderMocks(page, { forPay: true });

    let promoBody = null;
    let redirected = "";
    await page.route("https://pay.example/**", async (route) => {
      redirected = route.request().url();
      await route.fulfill({ status: 200, body: "pay" });
    });
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/subscriptions/promo")) {
        try {
          promoBody = JSON.parse(req.postData() || "{}");
        } catch {
          promoBody = null;
        }
      }
    });

    await page.goto("/subscriptions");
    await expect(page.getByRole("heading", { name: "Подписки" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Оплатить" }).click();
    await expect(page.getByRole("heading", { name: "Промокод" })).toBeVisible();
    await page.getByPlaceholder("Промокод").fill("VSEVMESTE");
    await page.getByRole("button", { name: "Применить" }).click();

    await expect.poll(() => promoBody?.code, { timeout: 15_000 }).toBe("VSEVMESTE");
    await expect(page.getByText(/Промокод применён/)).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => redirected, { timeout: 3_000 }).toBe("");
  });
});
