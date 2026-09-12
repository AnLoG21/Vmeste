import { test, expect } from "@playwright/test";
import { installProviderMocks, ORG_BOOKING } from "./helpers/mockProvider.js";

async function openBookingDaySheet(page) {
  await page.goto("/bookings");
  await expect(page.getByRole("heading", { name: "Записи клиентов" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator(".calendar-cell--has-items").first()).toBeVisible({ timeout: 15_000 });
  await page.locator(".calendar-cell--has-items").first().click();
  await expect(page.locator(".calendar-day-sheet")).toBeVisible();
}

async function reopenDaySheet(page) {
  await page.locator(".calendar-day-sheet-close").click();
  await expect(page.locator(".calendar-day-sheet")).toHaveCount(0);
  await page.locator(".calendar-cell--has-items").first().click();
  await expect(page.locator(".calendar-day-sheet")).toBeVisible();
}

test.describe("Org booking actions", () => {
  test("Подтвердить → POST confirm → Подтверждена", async ({ page }) => {
    await installProviderMocks(page, { bookings: [ORG_BOOKING] });

    let confirmUrl = "";
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/booking\/\d+\/confirm(?:\/|$)/.test(req.url())) {
        confirmUrl = req.url();
      }
    });

    await openBookingDaySheet(page);
    await page.locator(".calendar-day-sheet").getByTitle("Подтвердить").click();

    await expect
      .poll(() => confirmUrl, { timeout: 15_000 })
      .toContain(`/booking/${ORG_BOOKING.id}/confirm`);

    await reopenDaySheet(page);
    await expect(page.locator(".calendar-day-sheet").getByText("Подтверждена")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".calendar-day-sheet").getByTitle("Подтвердить")).toHaveCount(0);
  });

  test("Не пришёл → confirm → POST mark-no-show → Неявка", async ({ page }) => {
    await installProviderMocks(page, {
      bookings: [{ ...ORG_BOOKING, status: "confirmed" }],
    });

    let noShowUrl = "";
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/mark-no-show")) {
        noShowUrl = req.url();
      }
    });

    await openBookingDaySheet(page);
    await page.locator(".calendar-day-sheet").getByTitle("Не пришёл (no-show)").click();
    await expect(page.locator(".vmeste-confirm-backdrop")).toBeVisible();
    await page.locator(".vmeste-confirm-ok").click();

    await expect
      .poll(() => noShowUrl, { timeout: 15_000 })
      .toContain(`/booking/${ORG_BOOKING.id}/mark-no-show`);

    await reopenDaySheet(page);
    await expect(page.locator(".calendar-day-sheet").getByText("Неявка")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".calendar-day-sheet").getByTitle("Не пришёл (no-show)")).toHaveCount(
      0,
    );
  });

  test("Клиент пришёл → POST mark-arrived", async ({ page }) => {
    await installProviderMocks(page, {
      bookings: [{ ...ORG_BOOKING, status: "confirmed" }],
    });

    let arrivedUrl = "";
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/mark-arrived")) {
        arrivedUrl = req.url();
      }
    });

    await openBookingDaySheet(page);
    await page.locator(".calendar-day-sheet").getByTitle("Клиент пришёл").click();

    await expect
      .poll(() => arrivedUrl, { timeout: 15_000 })
      .toContain(`/booking/${ORG_BOOKING.id}/mark-arrived`);

    await reopenDaySheet(page);
    await expect(page.locator(".calendar-day-sheet").getByText("Клиент пришёл").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".calendar-day-sheet").getByTitle("Клиент пришёл")).toHaveCount(0);
  });

  test("Услуга оказана → POST mark-done → Оказана", async ({ page }) => {
    const started = new Date(Date.now() - 60 * 60_000);
    const ended = new Date(started.getTime() + 30 * 60_000);
    await installProviderMocks(page, {
      bookings: [
        {
          ...ORG_BOOKING,
          status: "arrived",
          slot_starts_at: started.toISOString(),
          slot_ends_at: ended.toISOString(),
        },
      ],
    });

    let doneUrl = "";
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/mark-done")) {
        doneUrl = req.url();
      }
    });

    await openBookingDaySheet(page);
    const doneBtn = page.locator(".calendar-day-sheet").getByRole("button", { name: "Услуга оказана" });
    await expect(doneBtn).toBeEnabled();
    await doneBtn.click();

    await expect
      .poll(() => doneUrl, { timeout: 15_000 })
      .toContain(`/booking/${ORG_BOOKING.id}/mark-done`);

    await reopenDaySheet(page);
    await expect(page.locator(".calendar-day-sheet").getByText("Оказана")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator(".calendar-day-sheet").getByRole("button", { name: "Услуга оказана" }),
    ).toHaveCount(0);
  });
});
