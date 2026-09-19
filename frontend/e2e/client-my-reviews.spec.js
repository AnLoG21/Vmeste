import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client my reviews route", () => {
  test("/my-reviews → client shell loads reviews API", async ({ page }) => {
    await installClientMocks(page);

    const reviewGets = [];
    page.on("request", (req) => {
      if (req.method() === "GET" && /\/reviews\/?(\?|$)/.test(new URL(req.url()).pathname + (new URL(req.url()).search || ""))) {
        reviewGets.push(req.url());
      }
      if (req.method() === "GET" && req.url().includes("/api/reviews")) {
        reviewGets.push(req.url());
      }
    });

    await page.goto("/my-reviews");
    await expect(page).toHaveURL(/\/my-reviews\/?$/, { timeout: 20_000 });
    await expect.poll(() => reviewGets.length, { timeout: 15_000 }).toBeGreaterThan(0);
  });
});
