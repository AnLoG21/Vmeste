import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider calendar rotate", () => {
  test("/organization → Сменить ссылку → POST calendar/settings", async ({ page }) => {
    await installProviderMocks(page);

    let rotated = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/booking/calendar/settings")) {
        rotated = true;
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Календарь записей" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("#org-ics-url")).toHaveValue(/calendar\/token-old\.ics/);

    await page.getByRole("button", { name: "Сменить ссылку" }).click();
    await expect.poll(() => rotated, { timeout: 15_000 }).toBe(true);
    await expect(page.locator("#org-ics-url")).toHaveValue(/calendar\/token-new\.ics/, {
      timeout: 10_000,
    });
    await expect(page.getByText(/Новая ссылка календаря/)).toBeVisible();
  });
});
