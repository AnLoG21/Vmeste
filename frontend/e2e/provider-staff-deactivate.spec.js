import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const STAFF = {
  id: 91,
  invitation_status: "accepted",
  is_active: true,
  job_title: "Мастер",
  staff: 502,
  staff_user: {
    id: 502,
    username: "staff-e2e",
    first_name: "Анна",
    last_name: "Мастер",
  },
  provider: 601,
};

test.describe("Provider staff deactivate", () => {
  test("/staff → Отключить → PATCH is_active false", async ({ page }) => {
    await installProviderMocks(page, { staff: [STAFF] });

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes(`/booking/staff/${STAFF.id}`)) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/staff");
    await expect(page.getByRole("heading", { name: "Сотрудники" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Анна/)).toBeVisible();
    await page.getByRole("button", { name: "Отключить" }).click();

    await expect.poll(() => patchBody?.is_active, { timeout: 15_000 }).toBe(false);
    await expect(page.getByText(/отключён/i)).toBeVisible({ timeout: 10_000 });
  });
});
