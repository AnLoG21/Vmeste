import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider voice greeting", () => {
  test("/organization → enable → greeting → PATCH voice/settings", async ({ page }) => {
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

    await panel.getByRole("checkbox", { name: /Включить голосового/i }).click();
    await panel.getByRole("checkbox", { name: /152-ФЗ/ }).click();
    await panel.locator("#voice-greeting").fill("Здравствуйте, это салон E2E.");
    await panel.getByRole("button", { name: "Сохранить настройки" }).click();

    await expect
      .poll(
        () =>
          patches.some(
            (p) =>
              p.enabled === true &&
              p.legal_ack === true &&
              String(p.greeting_text || "").includes("салон E2E"),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
    await expect(panel.getByText(/Настройки сохранены/i)).toBeVisible({ timeout: 10_000 });
  });
});
