import { test, expect } from "@playwright/test";
import { installClientMocks, DONE_BOOKING } from "./helpers/mockApi.js";

const EXISTING_REVIEW = {
  id: 7101,
  booking: DONE_BOOKING.id,
  provider: DONE_BOOKING.provider,
  rating: 5,
  text: "Всё понравилось",
  created_at: new Date().toISOString(),
  photos: [],
  reply: null,
};

const BOOKING_WITH_REVIEW = {
  ...DONE_BOOKING,
  review: {
    id: EXISTING_REVIEW.id,
    rating: EXISTING_REVIEW.rating,
    text: EXISTING_REVIEW.text,
    created_at: EXISTING_REVIEW.created_at,
  },
};

test.describe("Client review supplement", () => {
  test("Моё → Дополнить отзыв → PATCH /reviews/<id>/", async ({ page }) => {
    await installClientMocks(page, {
      bookings: [BOOKING_WITH_REVIEW],
      reviews: [EXISTING_REVIEW],
    });

    let patch = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/reviews/")) {
        patch = { url: req.url(), body: req.postData() || "" };
      }
    });

    await page.goto("/activity");
    await expect(page.getByRole("button", { name: "Все записи" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Все записи" }).click();

    await expect(page.getByRole("heading", { name: "Мои записи" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".calendar-cell--has-items").first()).toBeVisible({ timeout: 15_000 });
    await page.locator(".calendar-cell--has-items").first().click();

    await expect(page.locator(".calendar-day-sheet")).toBeVisible();
    await page.locator(".calendar-day-sheet").getByRole("button", { name: "Дополнить отзыв" }).click();

    await expect(page.locator("#review-modal-title")).toHaveText("Дополнить отзыв", { timeout: 10_000 });
    await page.getByPlaceholder("Дополнительный текст к отзыву").fill("Ещё раз спасибо");
    await page.locator(".review-modal-submit").click();

    await expect.poll(() => patch, { timeout: 15_000 }).not.toBeNull();
    expect(patch.url).toMatch(/\/reviews\/7101\/?/);
    expect(patch.body).toMatch(/Ещё раз спасибо|append_text/);
  });
});
