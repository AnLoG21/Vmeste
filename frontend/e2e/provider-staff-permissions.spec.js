import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const STAFF = {
  id: 92,
  invitation_status: "accepted",
  is_active: true,
  job_title: "Мастер",
  staff: 502,
  staff_user: {
    id: 502,
    username: "staff-perms-e2e",
    first_name: "Анна",
    last_name: "Права",
  },
  provider: 601,
  permissions: {
    manage_bookings: true,
    manage_intervals: false,
    manage_services: false,
    manage_chats: true,
    manage_client_chats: true,
    manage_staff: false,
    can_delegate_permissions: false,
  },
  assigned_service_ids: [],
  assigned_category_ids: [],
};

test.describe("Provider staff permissions", () => {
  test("/staff → toggle Календарь интервалов → PATCH permissions", async ({ page }) => {
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
    await page.getByRole("button", { name: /Права доступа/ }).click();
    await page.locator(".perm-item").filter({ hasText: "Календарь интервалов" }).locator("input[type=checkbox]").click();

    await expect.poll(() => patchBody?.permissions?.manage_intervals, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Права обновлены/i)).toBeVisible({ timeout: 10_000 });
  });
});
