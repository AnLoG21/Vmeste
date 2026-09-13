import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client telegram link", () => {
  test("/settings → Показать код / ссылку → GET telegram/link", async ({ page }) => {
    await installClientMocks(page);

    let linkRequested = false;
    page.on("request", (req) => {
      if (req.method() === "GET" && req.url().includes("/notifications/telegram/link")) {
        linkRequested = true;
      }
    });

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Показать код / ссылку" }).click();

    await expect.poll(() => linkRequested, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Не привязан/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/e2e-tg-token/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть бота" })).toHaveAttribute(
      "href",
      /t\.me\/vmeste_e2e_bot/,
    );
  });
});
