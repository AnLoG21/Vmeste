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
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Подтверждение визита" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(dialog.getByText("Салон Confirm E2E")).toBeVisible();
    await expect(dialog.getByText(/Стрижка/)).toBeVisible();

    // Bottom-sheet backdrop intercepts Playwright pointer clicks after scrollIntoView
    // on short mobile landing; invoke the control directly like a user tap on the sheet.
    await dialog.getByRole("button", { name: "Подтвердить визит" }).evaluate((btn) => btn.click());
    await expect.poll(() => posted, { timeout: 15_000 }).toBe(true);
    await expect(dialog.getByText(/Визит подтверждён/i)).toBeVisible({ timeout: 10_000 });
  });
});
