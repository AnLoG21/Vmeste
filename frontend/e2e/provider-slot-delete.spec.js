import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

function todayFreeSlot() {
  const start = new Date();
  start.setHours(11, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    id: 5301,
    provider: 601,
    staff: null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    is_booked: false,
    hold_label: "",
    anonymous_index: 1,
    service_ids: [],
    location: null,
    recurrence_group: "",
    is_manual_hold: false,
  };
}

test.describe("Provider slot delete", () => {
  test("/intervals → день → Удалить интервал → DELETE", async ({ page }) => {
    const slot = todayFreeSlot();
    await installProviderMocks(page, { slots: [slot] });

    let deletedId = null;
    page.on("request", (req) => {
      if (req.method() === "DELETE" && req.url().includes(`/booking/slots/${slot.id}`)) {
        deletedId = slot.id;
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
    await page.getByRole("button", { name: "Удалить интервал" }).click();

    await expect.poll(() => deletedId, { timeout: 15_000 }).toBe(5301);
    await expect(page.getByText(/Интервал удален/i)).toBeVisible({ timeout: 10_000 });
  });
});
