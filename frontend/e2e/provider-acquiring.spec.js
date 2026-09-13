import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider acquiring settings", () => {
  test("/organization → percent prepay → PATCH acquiring", async ({ page }) => {
    await installProviderMocks(page);

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/booking/acquiring")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Предоплата при записи" })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator("#org-prepay-mode").selectOption("percent");
    await page.locator("#org-prepay-percent").fill("40");
    await page.locator("#org-yk-shop").fill("e2e-shop");
    await page.locator("#org-yk-secret").fill("e2e-secret");
    await page.getByRole("button", { name: "Сохранить эквайринг" }).click();

    await expect.poll(() => patchBody?.prepay_mode, { timeout: 15_000 }).toBe("percent");
    expect(Number(patchBody.prepay_percent)).toBe(40);
    expect(patchBody.yookassa_shop_id).toBe("e2e-shop");
    await expect(page.getByText("Сохранено.")).toBeVisible({ timeout: 10_000 });
  });
});
