import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

function todayHoldSlot() {
  const start = new Date();
  start.setHours(14, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    id: 5201,
    provider: 601,
    staff: null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    is_booked: true,
    hold_label: "Пётр Холд",
    anonymous_index: 1,
    service_ids: [],
    location: null,
    recurrence_group: "",
    is_manual_hold: true,
  };
}

test.describe("Provider release manual hold", () => {
  test("/intervals → день → Снять ручную бронь → POST release-hold", async ({ page }) => {
    const hold = todayHoldSlot();
    await installProviderMocks(page, { slots: [hold] });

    let released = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes(`/booking/slots/${hold.id}/release-hold`)) {
        released = true;
      }
    });

    await page.goto("/intervals");
    await expect(page.getByRole("heading", { name: "Календарь интервалов" })).toBeVisible({
      timeout: 20_000,
    });

    const day = new Date().getDate();
    const cell = page
      .locator(".calendar-cell.clickable")
      .filter({ has: page.locator(".calendar-day", { hasText: new RegExp(`^${day}$`) }) });
    await cell.getByRole("button", { name: "Открыть день" }).click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Снять ручную бронь" }).click();

    await expect.poll(() => released, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Ручная бронь снята/i)).toBeVisible({ timeout: 10_000 });
  });
});
