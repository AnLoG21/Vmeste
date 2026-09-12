import { test, expect } from "@playwright/test";
import { installShopMocks, SLUG, ZONE_CENTER } from "./helpers/mockShop.js";
import { installYmapsStub, installPhotonSuggest, clickYmapsAt } from "./helpers/mockYmaps.js";

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

  test("delivery cash shows paid without pay redirect", async ({ page }) => {
    await installShopMocks(page, { online: false, delivery: true });
    let redirected = false;
    await page.route("https://pay.example/**", async (route) => {
      redirected = true;
      await route.fulfill({ status: 200, body: "pay" });
    });

    await page.goto(`/s/${SLUG}`);
    await expect(page.getByRole("heading", { name: "Магазин E2E" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /В корзину/ }).first().click();
    await page.getByRole("button", { name: /Корзина/ }).click();
    await page.getByRole("button", { name: /Доставка/ }).click();
    await page.getByPlaceholder("Телефон *").fill("+79007654321");
    await page.getByPlaceholder("Адрес доставки *").fill("ул. Доставки, 5");
    await page.locator("#shop-pay-method").selectOption("cash");
    await page.getByRole("button", { name: "Оформить заказ" }).click();

    await expect(page.getByRole("heading", { name: "Заказ #9003" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Статус:/)).toContainText("paid");
    expect(redirected).toBe(false);
  });

  test("delivery zone map pick posts lat/lon and shows paid", async ({ page }) => {
    await installYmapsStub(page);
    await installPhotonSuggest(page, { lat: 55.5, lon: 37.5, label: "ул. Зона, 1" });
    await installShopMocks(page, {
      online: false,
      delivery: true,
      deliveryZones: [ZONE_CENTER],
    });

    let orderBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes(`/shop/public/${SLUG}/order`)) {
        try {
          orderBody = JSON.parse(req.postData() || "{}");
        } catch {
          orderBody = null;
        }
      }
    });

    await page.goto(`/s/${SLUG}`);
    await expect(page.getByRole("heading", { name: "Магазин E2E" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /В корзину/ }).first().click();
    await page.getByRole("button", { name: /Корзина/ }).click();
    await page.getByRole("button", { name: /Доставка/ }).click();
    await page.getByPlaceholder("Телефон *").fill("+79007654321");
    await page.getByPlaceholder("Адрес доставки *").fill("ул. Зона, 1");
    await clickYmapsAt(page, 55.5, 37.5);
    await page.locator("#shop-pay-method").selectOption("cash");
    await page.getByRole("button", { name: "Оформить заказ" }).click();

    await expect.poll(() => orderBody, { timeout: 15_000 }).toMatchObject({
      mode: "delivery",
      delivery_method: "own",
      delivery_lat: 55.5,
      delivery_lon: 37.5,
    });
    await expect(page.getByRole("heading", { name: "Заказ #9003" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Статус:/)).toContainText("paid");
  });

  test("return ?order= shows paid status", async ({ page }) => {
    await installShopMocks(page);
    await page.goto(`/s/${SLUG}?order=9003`);
    await expect(page.getByRole("heading", { name: "Заказ #9003" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Статус:/)).toContainText("paid");
  });
});
