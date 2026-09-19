import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Services hub", () => {
  test("/services → хаб → Вменю / Вмагазине", async ({ page }) => {
    await installClientMocks(page);

    await page.goto("/services");
    await expect(page.getByRole("heading", { name: "Сервисы", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Вменю/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Вмагазине/ })).toBeVisible();

    await page.getByRole("button", { name: /Вменю/ }).click();
    await expect(page.getByRole("heading", { name: "Вменю", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/services");
    await expect(page.getByRole("heading", { name: "Сервисы", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /Вмагазине/ }).click();
    await expect(page.getByRole("navigation", { name: "Вмагазине" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
