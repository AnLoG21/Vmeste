import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider org messaging", () => {
  test("/organization → enable Telegram → PATCH messaging", async ({ page }) => {
    await installProviderMocks(page);

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/booking/messaging")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Напоминания и мессенджеры" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("checkbox", { name: /^Telegram$/ }).check();
    await page.getByRole("button", { name: "Сохранить напоминания" }).click();

    await expect.poll(() => patchBody?.enable_telegram, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText("Сохранено.").first()).toBeVisible({ timeout: 10_000 });
  });
});
