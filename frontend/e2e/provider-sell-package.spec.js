import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const OFFER = {
  id: 77,
  name: "5 стрижек",
  visits_count: 5,
  price: "4000.00",
  validity_days: 90,
  is_active: true,
};

test.describe("Provider sell package", () => {
  test("Услуги → Выдать → POST client-packages", async ({ page }) => {
    await installProviderMocks(page, { packages: [OFFER] });

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/booking/client-packages")) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/service-catalog");
    await expect(page.getByRole("heading", { name: "Выдать клиенту" })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator(".salon-loyalty-panel select").selectOption(String(OFFER.id));
    await page.getByPlaceholder("Логин клиента (как в чатах) или ID").fill("e2e-client");
    await page.getByPlaceholder("Комментарий").fill("выдача e2e");
    await page.getByRole("button", { name: "Выдать" }).click();

    await expect.poll(() => postBody?.package, { timeout: 15_000 }).toBe(OFFER.id);
    expect(postBody.client).toBe("e2e-client");
    await expect(page.getByText("Абонемент выдан клиенту.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Выданные" })).toBeVisible();
    await expect(page.locator(".salon-loyalty-panel ul.salon-package-list").last()).toContainText(
      "e2e-client",
    );
  });
});
