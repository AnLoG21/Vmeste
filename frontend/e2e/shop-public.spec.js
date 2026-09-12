import { test, expect } from "@playwright/test";
import { installShopMocks, SLUG } from "./helpers/mockShop.js";

test.describe("Public shop checkout", () => {
  test("online pickup redirects to pay URL", async ({ page }) => {
    await installShopMocks(page, { online: true });
    let redirected = "";
    await page.route("https://pay.example/**", async (route) => {
      redirected = route.request().url();
      await route.fulfill({ status: 200, body: "pay" });
    });

    await page.goto(`/s/${SLUG}`);
    await expect(page.getByRole("heading", { name: "Магазин E2E" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /В корзину/ }).first().click();
    await page.getByRole("button", { name: /Корзина/ }).click();
    await expect(page.getByRole("heading", { name: "Корзина" })).toBeVisible();

    await page.getByPlaceholder("Телефон *").fill("+79007654321");
    await page.getByRole("button", { name: "Оплатить" }).click();

    await expect.poll(() => redirected, { timeout: 15_000 }).toContain("pay.example/shop");
  });

  test("cash pickup shows paid without pay redirect", async ({ page }) => {
    await installShopMocks(page, { online: false });
    let redirected = false;
    await page.route("https://pay.example/**", async (route) => {
      redirected = true;
      await route.fulfill({ status: 200, body: "pay" });
    });

    await page.goto(`/s/${SLUG}`);
    await expect(page.getByRole("heading", { name: "Магазин E2E" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /В корзину/ }).first().click();
    await page.getByRole("button", { name: /Корзина/ }).click();
    await page.getByPlaceholder("Телефон *").fill("+79007654321");
    await page.locator("#shop-pay-method").selectOption("cash");
    await page.getByRole("button", { name: "Оформить заказ" }).click();

    await expect(page.getByRole("heading", { name: "Заказ #9003" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Статус:/)).toContainText("paid");
    expect(redirected).toBe(false);
  });

  test("return ?order= shows paid status", async ({ page }) => {
    await installShopMocks(page);
    await page.goto(`/s/${SLUG}?order=9003`);
    await expect(page.getByRole("heading", { name: "Заказ #9003" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Статус:/)).toContainText("paid");
  });
});
