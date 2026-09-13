import { test, expect } from "@playwright/test";
import { installClientMocks, ORG, CLIENT_BOOKING } from "./helpers/mockApi.js";

test.describe("Client activity feed", () => {
  test("Моё → booking + loyalty → tab Лояльность → Все записи", async ({ page }) => {
    await installClientMocks(page, {
      bookings: [CLIENT_BOOKING],
      loyaltyAccounts: [
        {
          id: 1,
          provider: ORG.provider,
          provider_name: ORG.organization_name,
          balance: 250,
          level: "gold",
          level_label: "Золото",
          updated_at: new Date().toISOString(),
        },
      ],
    });

    await page.goto("/activity");
    await expect(page.getByRole("heading", { name: "Моё" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(ORG.organization_name).first()).toBeVisible();
    await expect(page.getByText("Запись").first()).toBeVisible();
    await expect(page.getByText("Баллы").first()).toBeVisible();
    await expect(page.getByText(/250 баллов/)).toBeVisible();

    await page.getByRole("tab", { name: "Лояльность" }).click();
    await expect(page.getByText("Запись")).toHaveCount(0);
    await expect(page.getByText("Баллы")).toBeVisible();
    await expect(page.getByText(/250 баллов/)).toBeVisible();

    await page.getByRole("button", { name: "Все записи" }).click();
    await expect(page.getByRole("heading", { name: "Мои записи" })).toBeVisible({ timeout: 15_000 });
  });
});
