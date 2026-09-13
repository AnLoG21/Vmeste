import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider clients migrate request", () => {
  test("/clients → Оставить заявку → POST migrate-request", async ({ page }) => {
    await installProviderMocks(page);

    let note = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/booking/clients/migrate-request")) {
        note = req.postData() || "";
      }
    });

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "База клиентов" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Оставить заявку" }).click();

    await page.getByPlaceholder("Откуда переносим: Excel, YCLIENTS, блокнот…").fill("YCLIENTS, 120 клиентов");
    await page.getByRole("button", { name: "Отправить заявку" }).click();

    await expect.poll(() => (note || "").includes("YCLIENTS"), { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Заявка отправлена/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".clients-base-migrate-badge")).toContainText(/Новая/i);
  });
});
