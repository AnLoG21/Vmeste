import { test, expect } from "@playwright/test";
import { installCafeMocks, SLUG } from "./helpers/mockCafe.js";

test.describe("Cafe guest checkout", () => {
  test("online takeaway redirects to pay URL", async ({ page }) => {
    await installCafeMocks(page, { prepay: true });
    let redirected = "";
    await page.route("https://pay.example/**", async (route) => {
      redirected = route.request().url();
      await route.fulfill({ status: 200, body: "pay" });
    });

    await page.goto(`/m/${SLUG}`);
    await expect(page.getByRole("heading", { name: "Кафе E2E" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Борщ" })).toBeVisible();

    await page.locator(".cafe-menu-item").filter({ hasText: "Борщ" }).getByRole("button", { name: "+" }).click();
    await page.getByRole("button", { name: /Корзина/ }).click();
    await expect(page.getByRole("heading", { name: "Корзина" })).toBeVisible();

    await page.getByPlaceholder("Телефон *").fill("+79001234567");
    await page.locator("select").filter({ has: page.locator('option[value="online"]') }).selectOption("online");
    await page.getByRole("button", { name: "Оформить заказ" }).click();

    await expect.poll(() => redirected, { timeout: 15_000 }).toContain("pay.example/cafe");
  });

  test("return ?order= shows paid status", async ({ page }) => {
    await installCafeMocks(page);
    await page.addInitScript((session) => {
      const key = `cafe_sess_org_${"e2e-cafe"}`;
      sessionStorage.setItem(key, session);
      sessionStorage.setItem(
        `${key}_meta`,
        JSON.stringify({
          session_token: session,
          organization_name: "Кафе E2E",
          provider_slug: "e2e-cafe",
          is_open: true,
          modes: { dine_in: false, takeaway: true, delivery: false },
          pay_methods: { online: true, cash: true, card_on_spot: false },
        }),
      );
    }, "e2e-cafe-session-token");

    await page.goto(`/m/${SLUG}?order=9002`);
    await expect(page.getByTestId("cafe-order-status")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Заказ #9002" })).toBeVisible();
    await expect(page.getByText(/Статус:/)).toContainText("paid");
  });
});
