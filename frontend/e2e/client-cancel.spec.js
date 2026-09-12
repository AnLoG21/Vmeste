import { test, expect } from "@playwright/test";
import { installClientMocks, CLIENT_BOOKING } from "./helpers/mockApi.js";

test.describe("Client cancel booking", () => {
  test("Моё → Все записи → Отменить запись → cancel-by-client", async ({ page }) => {
    await installClientMocks(page, { bookings: [CLIENT_BOOKING] });

    let cancelUrl = "";
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/cancel-by-client")) {
        cancelUrl = req.url();
      }
    });

    // /bookings bootstraps clients to the map; open calendar via activity shortcut.
    await page.goto("/activity");
    await expect(page.getByRole("button", { name: "Все записи" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Все записи" }).click();

    await expect(page.getByRole("heading", { name: "Мои записи" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".calendar-cell--has-items").first()).toBeVisible({ timeout: 15_000 });
    await page.locator(".calendar-cell--has-items").first().click();

    await expect(page.locator(".calendar-day-sheet")).toBeVisible();
    await page.locator(".calendar-day-sheet").getByTitle("Отменить запись").click();

    await expect
      .poll(() => cancelUrl, { timeout: 15_000 })
      .toContain(`/booking/${CLIENT_BOOKING.id}/cancel-by-client`);

    // Day sheet keeps a snapshot until reopened after reloadBookingsList.
    await page.locator(".calendar-day-sheet-close").click();
    await expect(page.locator(".calendar-day-sheet")).toHaveCount(0);
    await page.locator(".calendar-cell--has-items").first().click();
    await expect(page.locator(".calendar-day-sheet").getByText("Отменена")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".calendar-day-sheet").getByTitle("Отменить запись")).toHaveCount(0);
  });
});
