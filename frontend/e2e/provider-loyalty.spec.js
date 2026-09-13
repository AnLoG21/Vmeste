import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider loyalty settings", () => {
  test("Услуги → включить лояльность → PATCH settings", async ({ page }) => {
    await installProviderMocks(page);

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/booking/loyalty/settings")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/service-catalog");
    await expect(page.getByRole("heading", { name: "Абонементы и лояльность" })).toBeVisible({
      timeout: 20_000,
    });

    const enable = page.getByRole("checkbox", { name: /Включить баллы/i });
    await enable.check();
    await page.getByLabel("Баллов за визит").fill("3");
    await page.getByLabel("1 балл = ₽ скидки").fill("2");
    await page.getByRole("button", { name: "Сохранить лояльность" }).click();

    await expect.poll(() => patchBody?.enabled, { timeout: 15_000 }).toBe(true);
    expect(Number(patchBody.points_per_visit)).toBe(3);
    expect(String(patchBody.rub_per_point)).toBe("2");
    await expect(page.getByText("Лояльность сохранена.")).toBeVisible({ timeout: 10_000 });
  });
});
