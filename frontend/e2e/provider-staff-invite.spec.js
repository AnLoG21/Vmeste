import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider staff invite create", () => {
  test("/staff → Отправить приглашение → POST /booking/staff/", async ({ page }) => {
    await installProviderMocks(page);

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/booking\/staff\/?$/.test(new URL(req.url()).pathname)) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/staff");
    await expect(page.getByRole("heading", { name: "Пригласить сотрудника" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByPlaceholder("email@example.com или login").fill("client-to-invite");
    await page.getByRole("button", { name: "Отправить приглашение" }).click();

    await expect.poll(() => postBody?.invite_identifier, { timeout: 15_000 }).toBe("client-to-invite");
    await expect(page.getByText(/Приглашение отправлено/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/ожидает подтверждения/)).toBeVisible({ timeout: 10_000 });
  });
});
