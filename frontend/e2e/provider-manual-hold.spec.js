import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider manual hold", () => {
  test("/intervals → Только занять время → POST manual-hold", async ({ page }) => {
    await installProviderMocks(page);

    let holdBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/booking/slots/manual-hold")) {
        try {
          holdBody = JSON.parse(req.postData() || "{}");
        } catch {
          holdBody = null;
        }
      }
    });

    await page.goto("/intervals");
    await expect(page.getByRole("heading", { name: "Календарь интервалов" })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator(".interval-manual-hold input[placeholder='Для поиска в базе']").fill("Пётр Холд");
    await page.getByRole("button", { name: "Только занять время (без клиента)" }).click();

    await expect.poll(() => holdBody?.guest_name, { timeout: 15_000 }).toBe("Пётр Холд");
    expect(holdBody.starts_at).toBeTruthy();
    expect(holdBody.ends_at).toBeTruthy();
    await expect(page.getByText(/Интервал забронирован/i)).toBeVisible({ timeout: 10_000 });
  });
});
