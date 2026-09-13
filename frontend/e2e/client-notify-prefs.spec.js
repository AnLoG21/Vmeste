import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client notify prefs", () => {
  test("/settings → uncheck reminders → PATCH me", async ({ page }) => {
    await installClientMocks(page);

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/users/me")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Уведомления о записях" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("checkbox", { name: /Напоминания за 24 ч/i }).uncheck();
    await page.getByRole("checkbox", { name: /Статусы: подтверждение/i }).uncheck();
    await page.getByRole("button", { name: "Сохранить уведомления" }).click();

    await expect.poll(() => patchBody?.notify_booking_reminders, { timeout: 15_000 }).toBe(false);
    expect(patchBody.notify_booking_status).toBe(false);
    await expect(page.getByText("Сохранено.")).toBeVisible({ timeout: 10_000 });
  });
});
