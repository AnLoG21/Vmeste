import { test, expect } from "@playwright/test";
import { installVisitConfirmMocks, VISIT_TOKEN } from "./helpers/mockVisitConfirm.js";

test.describe("Public visit confirm", () => {
  test("?visit_confirm= → Подтвердить визит → POST", async ({ page }) => {
    await installVisitConfirmMocks(page);

    let posted = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes(`/booking/public/visit-confirm/${VISIT_TOKEN}`)) {
        posted = true;
      }
    });

    await page.goto(`/?visit_confirm=${VISIT_TOKEN}`);
    await expect(page.getByRole("heading", { name: "Подтверждение визита" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Салон Confirm E2E")).toBeVisible();
    await expect(page.getByText(/Стрижка/)).toBeVisible();

    await page.getByRole("button", { name: "Подтвердить визит" }).click();
    await expect.poll(() => posted, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Визит подтверждён/i)).toBeVisible({ timeout: 10_000 });
  });
});
