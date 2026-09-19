import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider voice simulate turn", () => {
  test("/organization → simulate → turn POST", async ({ page }) => {
    await installProviderMocks(page);

    const turns = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/voice/session/") && req.url().includes("/turn")) {
        turns.push({
          url: req.url(),
          token: req.headers()["x-voice-token"] || "",
          body: req.postData() || "",
        });
      }
    });

    await page.goto("/organization");
    const panel = page.locator(".voice-admin-panel");
    await expect(panel.getByRole("heading", { name: "Голосовой администратор" })).toBeVisible({
      timeout: 20_000,
    });
    await panel.scrollIntoViewIfNeeded();

    await panel.getByRole("button", { name: "Начать тестовый диалог" }).click();
    await expect(panel.getByText(/тестовый диалог голосового/i)).toBeVisible({
      timeout: 10_000,
    });

    await panel.getByPlaceholder(/маникюр завтра/i).fill("маникюр завтра к Лене");
    await panel.locator(".voice-sim-input-row").getByRole("button", { name: "Отправить" }).click();

    await expect.poll(() => turns.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(turns[0].token).toBe("e2e-voice-token");
    expect(turns[0].body).toMatch(/маникюр/);
    await expect(panel.getByText(/Понял: маникюр завтра к Лене/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
