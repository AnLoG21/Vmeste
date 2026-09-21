import { test, expect } from "@playwright/test";
import { installVmagazineMocks } from "./helpers/mockVmagazine.js";

test.describe("Вмагазине payment cards", () => {
  test("/vmagazine → Профиль → добавить карту", async ({ page }) => {
    await installVmagazineMocks(page, {
      bonuses: [
        {
          provider_id: 922,
          provider_name: "Лавка E2E",
          shop_url: "/s/lavka-e2e",
          balance: "25.00",
          updated_at: "2026-03-01T12:00:00Z",
        },
      ],
    });

    const posts = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/vmagazine/payment-cards")) {
        posts.push(req.postData() || "");
      }
    });

    await page.goto("/vmagazine");
    await expect(page.getByRole("navigation", { name: "Вмагазине" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("navigation", { name: "Вмагазине" }).getByRole("button", { name: "Профиль", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Профиль", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole("heading", { name: "Вбонусы", exact: true })).toBeVisible();
    await expect(page.getByText("Лавка E2E")).toBeVisible();

    await page.getByRole("heading", { name: "Карты", exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Добавить карту" }).click();
    await page.getByPlaceholder("Номер карты").fill("4111111111111111");
    await page.getByPlaceholder("ММ").fill("12");
    await page.getByPlaceholder("ГГГГ").fill("2030");
    await page.getByRole("button", { name: "Сохранить карту" }).click();

    await expect.poll(() => posts.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByText("1111")).toBeVisible({ timeout: 10_000 });
  });
});
