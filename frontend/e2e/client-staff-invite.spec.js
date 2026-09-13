import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

const INVITE = {
  id: 88,
  invitation_status: "pending",
  provider_user: {
    id: 201,
    username: "salon-e2e",
    organization_name: "Салон E2E",
  },
};

test.describe("Client staff invite", () => {
  test("/cabinet → Подтвердить → POST accept-invite", async ({ page }) => {
    await installClientMocks(page, {
      pendingStaffInvites: [INVITE],
    });

    let accepted = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes(`/booking/staff/${INVITE.id}/accept-invite`)) {
        accepted = true;
      }
    });

    await page.goto("/cabinet");
    await expect(page.getByText(/Приглашение присоединиться/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Салон E2E")).toBeVisible();
    await page.getByRole("button", { name: "Подтвердить" }).click();

    await expect.poll(() => accepted, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Приглашение присоединиться/)).toHaveCount(0, { timeout: 10_000 });
  });
});
