import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider voice settings", () => {
  test("/organization → enable + 152-ФЗ → PATCH voice/settings", async ({ page }) => {
    await installProviderMocks(page);

    const patches = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/voice/settings")) {
        try {
          patches.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/organization");
    const panel = page.locator(".voice-admin-panel");
    await expect(panel.getByRole("heading", { name: "Голосовой администратор" })).toBeVisible({
      timeout: 20_000,
    });
    await panel.scrollIntoViewIfNeeded();

    const enable = panel.getByRole("checkbox", { name: /Включить голосового/i });
    const legal = panel.getByRole("checkbox", { name: /152-ФЗ/ });
    await expect(enable).not.toBeChecked();
    await expect(legal).not.toBeChecked();

    await enable.click();
    await legal.click();
    await panel.getByRole("button", { name: "Сохранить настройки" }).click();

    await expect
      .poll(() => patches.some((p) => p.enabled === true && p.legal_ack === true), {
        timeout: 15_000,
      })
      .toBe(true);
    await expect(panel.getByText(/Настройки сохранены/i)).toBeVisible({ timeout: 10_000 });
  });
});
