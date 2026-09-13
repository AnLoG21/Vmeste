import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client in-app notifications", () => {
  test("/cabinet → Понятно → POST mark-read", async ({ page }) => {
    await installClientMocks(page, {
      activityNotifications: [
        {
          id: 41,
          kind: "booking",
          payload: { title: "Запись", body: "Подтверждена", when: "завтра 15:00" },
          created_at: new Date().toISOString(),
        },
      ],
    });

    let markBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/notifications/in-app/mark-read")) {
        try {
          markBody = JSON.parse(req.postData() || "{}");
        } catch {
          markBody = null;
        }
      }
    });

    await page.goto("/cabinet");
    await expect(page.locator(".chat-notif-card").getByText(/Запись · Подтверждена/)).toBeVisible({
      timeout: 20_000,
    });
    await page.locator(".chat-notif-card").getByRole("button", { name: "Понятно" }).click();

    await expect.poll(() => markBody?.ids, { timeout: 15_000 }).toEqual([41]);
    await expect(page.locator(".chat-notif-card")).toHaveCount(0, { timeout: 10_000 });
  });
});
