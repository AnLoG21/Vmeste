import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const CATEGORY = { id: 11, name: "Стрижки", provider: 601 };
const SERVICE = {
  id: 301,
  name: "Стрижка",
  price: "1000.00",
  duration_minutes: 30,
  is_active: true,
  category: 11,
  options: [],
  gallery: [],
};

const STAFF = {
  id: 93,
  invitation_status: "accepted",
  is_active: true,
  job_title: "Мастер",
  staff: 503,
  staff_user: {
    id: 503,
    username: "staff-svc-e2e",
    first_name: "Борис",
    last_name: "Услуги",
  },
  provider: 601,
  permissions: { manage_bookings: true },
  assigned_service_ids: [],
  assigned_category_ids: [],
};

test.describe("Provider staff service assignment", () => {
  test("/staff → assign service → PATCH assigned_service_ids", async ({ page }) => {
    await installProviderMocks(page, {
      staff: [STAFF],
      catalogCategories: [CATEGORY],
      catalogServices: [SERVICE],
    });

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

    const catalogWait = page.waitForResponse(
      (res) => res.url().includes("/catalog/services") && res.request().method() === "GET",
      { timeout: 20_000 },
    );
    await page.goto("/staff");
    await catalogWait;
    await expect(page.getByRole("heading", { name: "Сотрудники" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Услуги сотрудника/ }).click();
    await expect(page.locator(".staff-svc-item").filter({ hasText: "Стрижка" })).toBeVisible({
      timeout: 10_000,
    });
    await page.locator(".staff-svc-item").filter({ hasText: "Стрижка" }).locator("input[type=checkbox]").click();

    await expect.poll(() => patchBody?.assigned_service_ids, { timeout: 15_000 }).toEqual([301]);
    expect(patchBody.assigned_category_ids).toEqual([11]);
    await expect(page.getByText(/Услуги сотрудника обновлены/i)).toBeVisible({ timeout: 10_000 });
  });
});
