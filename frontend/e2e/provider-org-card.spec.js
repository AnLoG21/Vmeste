import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider org client card", () => {
  test("/organization → Сохранить карточку → PATCH organization-info", async ({ page }) => {
    await installProviderMocks(page);

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/users/organization-info")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Карточка для клиентов" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("checkbox", { name: /Воскресенье — выходной/i }).check();
    await page.getByRole("button", { name: "+ Телефон" }).click();
    await page.getByPlaceholder("+7 …").last().fill("+79001112233");
    await page.getByPlaceholder("Например: парковка во дворе, вход со двора").fill("Парковка во дворе");
    await page.getByRole("button", { name: "Сохранить карточку" }).click();

    await expect.poll(() => patchBody?.organization_working_hours?.sun?.closed, { timeout: 15_000 }).toBe(
      true,
    );
    expect(patchBody.organization_phones).toContain("+79001112233");
    expect(patchBody.organization_card_note).toBe("Парковка во дворе");
    await expect(page.getByText("Сохранено.")).toBeVisible({ timeout: 10_000 });
  });
});
