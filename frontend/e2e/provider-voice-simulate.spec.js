import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider voice simulate", () => {
  test("/organization → simulate → POST /api/voice/simulate/", async ({ page }) => {
    await installProviderMocks(page);

    const posts = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/voice/simulate")) {
        posts.push({
          url: req.url(),
          token: req.headers()["x-voice-token"] || "",
        });
      }
    });

    await page.goto("/organization");
    const panel = page.locator(".voice-admin-panel");
    await expect(panel.getByRole("heading", { name: "Голосовой администратор" })).toBeVisible({
      timeout: 20_000,
    });
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByRole("heading", { name: /Тест без телефона/i })).toBeVisible();
    await panel.getByRole("button", { name: "Начать тестовый диалог" }).click();

    await expect.poll(() => posts.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(posts[0].token).toBe("e2e-voice-token");
    await expect(panel.getByText(/тестовый диалог голосового/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
