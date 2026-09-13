import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const STAFF = {
  id: 94,
  invitation_status: "accepted",
  is_active: true,
  job_title: "",
  staff: 504,
  staff_user: {
    id: 504,
    username: "staff-preset-e2e",
    first_name: "Вера",
    last_name: "Ресепшн",
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

test.describe("Provider staff role preset", () => {
  test("/staff → пресет Администратор ресепшн → PATCH permissions + job_title", async ({ page }) => {
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
    await page.getByRole("button", { name: "Администратор ресепшн" }).click();

    await expect.poll(() => patchBody?.permissions?.manage_intervals, { timeout: 15_000 }).toBe(true);
    expect(patchBody.permissions.manage_bookings).toBe(true);
    expect(patchBody.permissions.manage_staff).toBe(false);
    expect(patchBody.job_title).toBe("Администратор");
    await expect(page.getByText("Сохранено.")).toBeVisible({ timeout: 10_000 });
  });
});
