import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider create package", () => {
  test("Услуги → Создать абонемент → POST packages", async ({ page }) => {
    await installProviderMocks(page);

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/booking\/packages\/?$/.test(new URL(req.url()).pathname)) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/service-catalog");
    await expect(page.getByRole("heading", { name: "Абонементы и лояльность" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByPlaceholder("Название (например, 5 стрижек)").fill("10 стрижек E2E");
    await page.getByPlaceholder("Визитов").fill("10");
    await page.getByPlaceholder("Цена ₽").fill("7000");
    await page.getByPlaceholder("Срок действия, дней").fill("120");
    await page.getByRole("button", { name: "Создать абонемент" }).click();

    await expect.poll(() => postBody?.name, { timeout: 15_000 }).toBe("10 стрижек E2E");
    expect(Number(postBody.visits_count)).toBe(10);
    expect(String(postBody.price)).toBe("7000");
    await expect(page.getByText("Абонемент создан.")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".salon-package-row").getByText("10 стрижек E2E")).toBeVisible();
  });
});
