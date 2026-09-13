import { test, expect } from "@playwright/test";
import { installBookingWidgetMocks, WIDGET_SLUG } from "./helpers/mockBookingWidget.js";

test.describe("Public booking widget", () => {
  test("/w/:slug → услуга → время → Записаться → POST book", async ({ page }) => {
    await installBookingWidgetMocks(page);

    let bookBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes(`/booking/public/${WIDGET_SLUG}/book`)) {
        try {
          bookBody = JSON.parse(req.postData() || "{}");
        } catch {
          bookBody = null;
        }
      }
    });

    await page.goto(`/w/${WIDGET_SLUG}`);
    await expect(page.getByRole("heading", { name: "Салон Widget E2E" })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator("#bw-service").selectOption("301");
    await expect(page.locator(".bw-slot").first()).toBeVisible({ timeout: 10_000 });
    await page.locator(".bw-slot").first().click();
    await page.locator("#bw-name").fill("Анна");
    await page.locator("#bw-phone").fill("+79001112233");
    await page.getByRole("button", { name: "Записаться" }).click();

    await expect.poll(() => bookBody?.service, { timeout: 15_000 }).toBe(301);
    expect(bookBody.guest_phone).toBe("+79001112233");
    expect(bookBody.starts_at).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Вы записаны" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Стрижка/)).toBeVisible();
  });
});
