import { test, expect } from "@playwright/test";
import { installClientMocks, ORG, CLIENT_PACKAGE } from "./helpers/mockApi.js";

test.describe("Client loyalty page", () => {
  test("Лояльность → org → buy package → POST purchase", async ({ page }) => {
    await installClientMocks(page, {
      loyaltyAccounts: [
        {
          id: 1,
          provider: ORG.provider,
          provider_name: ORG.organization_name,
          balance: 250,
          level: "gold",
          level_label: "Золото",
        },
      ],
      loyalty: {
        enabled: true,
        balance: 250,
        rub_per_point: "2.00",
        provider: ORG.provider,
        provider_name: ORG.organization_name,
      },
      clientPackages: [],
      offerPackages: [
        {
          id: 77,
          provider: ORG.provider,
          name: "5 стрижек",
          visits_count: 5,
          price: "4000.00",
          validity_days: 90,
          is_active: true,
          description: "",
        },
      ],
    });

    let purchasePost = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/packages\/\d+\/purchase\/?$/.test(new URL(req.url()).pathname)) {
        purchasePost = req.url();
      }
    });

    await page.goto("/loyalty");
    await expect(page.getByRole("heading", { name: "Лояльность и абонементы" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(ORG.organization_name)).toBeVisible();
    await expect(page.getByText("250 баллов")).toBeVisible();

    await page.getByRole("button", { name: new RegExp(ORG.organization_name) }).click();
    await expect(page.getByRole("heading", { name: ORG.organization_name })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Баллы:/)).toContainText("250");
    await expect(page.getByText(/1 балл ≈ 2/)).toBeVisible();

    await page.getByRole("button", { name: "Купить" }).click();
    await expect.poll(() => purchasePost, { timeout: 15_000 }).toMatch(/\/packages\/77\/purchase/);
    await expect(page.getByText(/Абонемент оформлен/)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".client-loyalty-packages").getByText(CLIENT_PACKAGE.package_name)).toBeVisible();
  });
});
