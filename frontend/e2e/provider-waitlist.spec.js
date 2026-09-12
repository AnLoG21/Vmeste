import { test, expect } from "@playwright/test";
import { installProviderMocks, WAITLIST_ENTRY } from "./helpers/mockProvider.js";

test.describe("Org waitlist", () => {
  test("Записи → Снять waitlist → PATCH cancelled", async ({ page }) => {
    await installProviderMocks(page, { waitlist: [WAITLIST_ENTRY] });

    let patchBody = null;
    let patchUrl = "";
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/booking/waitlist/")) {
        patchUrl = req.url();
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: "Записи клиентов" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Лист ожидания" })).toBeVisible();
    await expect(page.getByText(WAITLIST_ENTRY.client_name)).toBeVisible();

    await page.getByRole("button", { name: "Снять" }).click();

    await expect.poll(() => patchUrl, { timeout: 15_000 }).toContain(`/booking/waitlist/${WAITLIST_ENTRY.id}`);
    await expect.poll(() => patchBody, { timeout: 5_000 }).toMatchObject({ status: "cancelled" });
    await expect(page.getByRole("heading", { name: "Лист ожидания" })).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
