import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider cafe settings", () => {
  test("/cafe → Режимы → toggle delivery + online payment", async ({ page }) => {
    await installProviderMocks(page, { providerSphere: "cafe_restaurant" });

    const patches = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/cafe/settings")) {
        try {
          patches.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/cafe");
    await expect(page.getByRole("heading", { name: "Зал и меню" })).toBeVisible({ timeout: 20_000 });
    await page
      .locator(".cafe-provider-tabs")
      .getByRole("button", { name: "Режимы, доставка и оплата", exact: true })
      .click();

    const delivery = page.locator("label.checkbox").filter({ hasText: "Доставка" });
    const online = page.locator("label.checkbox").filter({ hasText: "Онлайн-оплата" });
    await expect(delivery.locator("input")).not.toBeChecked();
    await expect(online.locator("input")).not.toBeChecked();

    await delivery.click();
    await expect.poll(() => patches.some((p) => p.enable_delivery === true), { timeout: 15_000 }).toBe(true);
    await expect(delivery.locator("input")).toBeChecked();

    await online.click();
    await expect
      .poll(() => patches.some((p) => p.accept_online_payment === true), { timeout: 15_000 })
      .toBe(true);
    await expect(online.locator("input")).toBeChecked();
  });
});
