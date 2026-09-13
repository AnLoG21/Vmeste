import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider shop settings", () => {
  test("/shop → Настройки → toggle delivery + online payment", async ({ page }) => {
    await installProviderMocks(page, { providerSphere: "shops" });

    const patches = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/shop/settings")) {
        try {
          patches.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "Магазин / склад" })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator(".shop-tabs").getByRole("button", { name: "Настройки", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Самовывоз и доставка" })).toBeVisible({
      timeout: 10_000,
    });

    const delivery = page.getByRole("checkbox", { name: "Доставка", exact: true });
    const online = page.getByRole("checkbox", { name: "Онлайн-оплата", exact: true });
    await expect(delivery).not.toBeChecked();
    await expect(online).not.toBeChecked();

    await delivery.click();
    await expect.poll(() => patches.some((p) => p.enable_delivery === true), { timeout: 15_000 }).toBe(true);
    await expect(delivery).toBeChecked();

    await online.click();
    await expect
      .poll(() => patches.some((p) => p.accept_online_payment === true), { timeout: 15_000 })
      .toBe(true);
    await expect(online).toBeChecked();
  });
});
