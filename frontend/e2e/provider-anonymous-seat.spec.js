import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider anonymous seat", () => {
  test("/intervals → Добавить место без сотрудника → PATCH me", async ({ page }) => {
    await installProviderMocks(page);

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && /\/users\/me\/?$/.test(new URL(req.url()).pathname)) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/intervals");
    await expect(page.getByRole("heading", { name: "Календарь интервалов" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Добавить место без сотрудника" }).click();

    await expect.poll(() => patchBody?.anonymous_seat_count, { timeout: 15_000 }).toBe(2);
    await expect(page.getByText(/Добавлено: Без сотрудников 2/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("select").locator('option[value="anon:2"]')).toHaveCount(1);
  });
});
