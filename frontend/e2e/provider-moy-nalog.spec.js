import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider MoyNalog panel", () => {
  test("/organization → toggle auto receipt → PATCH status", async ({ page }) => {
    await installProviderMocks(page, { moyNalogConnected: true });

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/moy-nalog/status")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: /Мой налог/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Подключено/)).toBeVisible();

    const toggle = page.getByRole("checkbox", { name: /Автоматически выбивать чек/i });
    await expect(toggle).toBeChecked();
    await toggle.click();

    await expect.poll(() => patchBody?.enabled, { timeout: 15_000 }).toBe(false);
    await expect(toggle).not.toBeChecked({ timeout: 10_000 });
  });
});
