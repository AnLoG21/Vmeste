import { test, expect } from "@playwright/test";
import { installInspectionPublicMocks, TOKEN } from "./helpers/mockInspectionPublic.js";

test.describe("Public inspection approve", () => {
  test("/i/:token → Утвердить ремонт → POST approve", async ({ page }) => {
    await installInspectionPublicMocks(page);

    let approveBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes(`/inspections/public/${TOKEN}/approve`)) {
        try {
          approveBody = JSON.parse(req.postData() || "{}");
        } catch {
          approveBody = null;
        }
      }
    });

    await page.goto(`/i/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "Согласование работ" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("СТО E2E")).toBeVisible();
    await expect(page.getByText(/Solaris/)).toBeVisible();
    await expect(page.getByText("Колодки")).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Утвердить ремонт" }).click();

    await expect.poll(() => approveBody?.selected_item_ids, { timeout: 15_000 }).toEqual([91]);
    await expect(page.getByText("Утверждено")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Утвердить ремонт" })).toHaveCount(0);
  });
});
