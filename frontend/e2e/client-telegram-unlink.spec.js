import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client telegram unlink", () => {
  test("/settings → Отвязать → DELETE telegram/link", async ({ page }) => {
    await installClientMocks(page, {
      telegramLinked: true,
    });

    let deleted = false;
    page.on("request", (req) => {
      if (req.method() === "DELETE" && req.url().includes("/notifications/telegram/link")) {
        deleted = true;
      }
    });

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Показать код / ссылку" }).click();
    await expect(page.getByText(/Привязан/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Отвязать" }).click();

    await expect.poll(() => deleted, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Не привязан/)).toBeVisible({ timeout: 10_000 });
  });
});
