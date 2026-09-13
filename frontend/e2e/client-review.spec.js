import { test, expect } from "@playwright/test";
import { installClientMocks, DONE_BOOKING } from "./helpers/mockApi.js";

test.describe("Client review after done booking", () => {
  test("Моё → Все записи → Отзыв → POST /reviews/", async ({ page }) => {
    await installClientMocks(page, { bookings: [DONE_BOOKING] });

    let reviewPost = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/reviews\/?$/.test(new URL(req.url()).pathname.replace(/\/+$/, "") || "/")) {
        reviewPost = {
          url: req.url(),
          body: req.postData() || "",
        };
      }
    });

    await page.goto("/activity");
    await expect(page.getByRole("button", { name: "Все записи" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Все записи" }).click();

    await expect(page.getByRole("heading", { name: "Мои записи" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".calendar-cell--has-items").first()).toBeVisible({ timeout: 15_000 });
    await page.locator(".calendar-cell--has-items").first().click();

    await expect(page.locator(".calendar-day-sheet")).toBeVisible();
    await page.locator(".calendar-day-sheet").getByRole("button", { name: "Отзыв" }).click();

    await expect(page.locator("#review-modal-title")).toHaveText("Отзыв", { timeout: 10_000 });
    await page.getByRole("button", { name: "5" }).click();
    await page.getByPlaceholder("Комментарий об услуге (необязательно)").fill("Всё понравилось");
    await page.locator(".review-modal-submit").click();

    await expect.poll(() => reviewPost, { timeout: 15_000 }).not.toBeNull();
    expect(reviewPost.url).toMatch(/\/reviews\/?/);
    expect(reviewPost.body).toContain(String(DONE_BOOKING.id));
    expect(reviewPost.body).toMatch(/rating[\s\S]*5|name="rating"/);

    await expect(page.locator("#review-modal-title")).toHaveCount(0, { timeout: 10_000 });
    await page.locator(".calendar-day-sheet-close").click();
    await expect(page.locator(".calendar-day-sheet")).toHaveCount(0);
    await page.locator(".calendar-cell--has-items").first().click();
    await expect(page.locator(".calendar-day-sheet").getByRole("button", { name: "Отзыв" })).toHaveCount(0);
  });
});
